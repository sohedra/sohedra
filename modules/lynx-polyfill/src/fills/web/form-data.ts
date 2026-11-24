// `FormData`: the XMLHttpRequest Standard § 5 "Interface FormData", with HTML § 4.10.21.8
// "Multipart form data" to write one as a body, and the Fetch Standard's multipart/form-data parser
// (RFC 7578) to read one (`Response.formData()`). The background lacks it. Background only, over
// the thread's `Blob` and `File`.
//
// Leaves out: a form element to read entries from (Lynx has none: `new FormData(form)` throws);
// and in a body read, a part's `filename*` and its `Content-Transfer-Encoding`, which RFC 7578
// § 4.2 and § 4.7 deprecate. A body read is untrusted input: `MULTIPART_LIMITS` caps how many parts
// it has and how long each part's headers are.

import type { Scope } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { record } from "./record.ts";
import type { Loaded } from "./record.ts";
import type { BlobClass, FileClass, FormDataClass, TextDecoderClass } from "./standard-classes.ts";

/** @workaround web-form-data kind=lynx-gap delete-when="Lynx's background thread has a global FormData" */
export function fillFormData(scope: Scope): void {
	installLazy(scope, "FormData", () => createFormData(scope), isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** An entry: its name, and a string or a `File`. */
type Entry = [name: string, value: FormDataEntryValue];

/** WebIDL's `USVString` of a value: text, each lone surrogate made U+FFFD. */
function usv(value: unknown): string {
	if (typeof value === "symbol") throw new TypeError("FormData can't take a symbol as text.");
	const text = `${value as string}`;
	let out = "";
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		if (code < 0xd800 || code > 0xdfff) out += text[index]!;
		else if (code <= 0xdbff && (text.charCodeAt(index + 1) & 0xfc00) === 0xdc00) {
			out += text.slice(index, index + 2);
			index++;
		} else out += String.fromCharCode(0xfffd);
	}
	return out;
}

/** The thread's `FormData`, its files the thread's `File`s. */
export function createFormData(scope: Scope): FormDataClass {
	const lists = new WeakMap<object, Entry[]>();
	const listOf = (form: unknown): Entry[] => {
		const found = typeof form === "object" && form !== null ? lists.get(form) : undefined;
		if (!found) throw new TypeError("Illegal invocation: not a FormData.");
		return found;
	};
	// Boundary: the thread's `Blob` and `File`, this folder's or an engine's.
	const BlobClass = (): BlobClass => scope["Blob"] as BlobClass;
	const FileClass = (): FileClass => scope["File"] as FileClass;

	/** XHR's "create an entry". */
	const entryOf = (method: string, args: unknown[]): Entry => {
		if (args.length < 2)
			throw new TypeError(`FormData.${method} takes a name and a value, and was given fewer.`);
		const [name, value, filename] = args;
		const isBlob = typeof BlobClass() === "function" && value instanceof BlobClass();
		if (!isBlob) {
			if (args.length > 2)
				throw new TypeError(`FormData.${method} takes a file name only with a Blob.`);
			return [usv(name), usv(value)];
		}
		const blob = value as Blob;
		const File = FileClass();
		if (blob instanceof File && filename === undefined) return [usv(name), blob];
		const file = new File([blob], filename === undefined ? "blob" : usv(filename), {
			type: blob.type,
			...(blob instanceof File && { lastModified: blob.lastModified }),
		});
		return [usv(name), file];
	};

	class FormDataFill {
		constructor(form?: unknown) {
			if (form !== undefined)
				throw new TypeError("FormData can't read a form element: Lynx has none.");
			lists.set(this, []);
		}

		append(...args: [name: string, value: string | Blob, filename?: string]): void {
			listOf(this).push(entryOf("append", args));
		}

		set(...args: [name: string, value: string | Blob, filename?: string]): void {
			const list = listOf(this);
			const entry = entryOf("set", args);
			const first = list.findIndex(([name]) => name === entry[0]);
			if (first === -1) {
				list.push(entry);
				return;
			}
			list[first] = entry;
			for (let index = list.length - 1; index > first; index--)
				if (list[index]![0] === entry[0]) list.splice(index, 1);
		}

		delete(name: string): void {
			const list = listOf(this);
			const key = usv(name);
			for (let index = list.length - 1; index >= 0; index--)
				if (list[index]![0] === key) list.splice(index, 1);
		}

		get(name: string): FormDataEntryValue | null {
			const key = usv(name);
			return listOf(this).find(([each]) => each === key)?.[1] ?? null;
		}

		getAll(name: string): FormDataEntryValue[] {
			const key = usv(name);
			return listOf(this).flatMap(([each, value]) => (each === key ? [value] : []));
		}

		has(name: string): boolean {
			const key = usv(name);
			return listOf(this).some(([each]) => each === key);
		}

		forEach(
			callback: (value: FormDataEntryValue, name: string, parent: FormData) => void,
			thisArg?: unknown,
		): void {
			if (typeof callback !== "function") throw new TypeError("FormData.forEach takes a function.");
			const list = listOf(this);
			for (let index = 0; index < list.length; index++) {
				const [name, value] = list[index]!;
				// Boundary: this object, as TypeScript's DOM library types it.
				callback.call(thisArg, value, name, this as unknown as FormData);
			}
		}

		*entries(): IterableIterator<[string, FormDataEntryValue]> {
			// Live, as WebIDL's iterators are: an entry added while iterating is reached.
			const list = listOf(this);
			for (let index = 0; index < list.length; index++) yield [...list[index]!];
		}

		*keys(): IterableIterator<string> {
			for (const [name] of this.entries()) yield name;
		}

		*values(): IterableIterator<FormDataEntryValue> {
			for (const [, value] of this.entries()) yield value;
		}

		[Symbol.iterator](): IterableIterator<[string, FormDataEntryValue]> {
			return this.entries();
		}
	}
	// Boundary: the class above, as TypeScript's DOM library types it.
	return named(FormDataFill, "FormData") as unknown as FormDataClass;
}

/** UTF-8 of a string that holds no lone surrogate, as a `FormData`'s names and values are. */
function utf8(text: string): Uint8Array {
	const out: number[] = [];
	for (let index = 0; index < text.length; index++) {
		let code = text.codePointAt(index)!;
		if (code > 0xffff) index++;
		if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
		if (code < 0x80) out.push(code);
		else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
		else if (code < 0x10000)
			out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
		else
			out.push(
				0xf0 | (code >> 18),
				0x80 | ((code >> 12) & 0x3f),
				0x80 | ((code >> 6) & 0x3f),
				0x80 | (code & 0x3f),
			);
	}
	return new Uint8Array(out);
}

/** Every line break made CRLF. */
function crlf(text: string): string {
	return text.replace(/\r\n|\r|\n/g, "\r\n");
}

/** A name or file name in a part's header: `"`, CR and LF percent-encoded, as HTML says. */
function escapeName(text: string): string {
	return text.replace(/\n/g, "%0A").replace(/\r/g, "%0D").replace(/"/g, "%22");
}

/** A fresh boundary for a multipart/form-data body, random as browsers make theirs. */
export function multipartBoundary(): string {
	let random = "";
	for (let index = 0; index < 16; index++) random += Math.floor(Math.random() * 10);
	return `----formdata-sohedra-${random}`;
}

/**
 * HTML's multipart/form-data encoding of `form`, between lines of `boundary`: the body's bytes. Its
 * `Content-Type` is `multipart/form-data; boundary=${boundary}`.
 */
export async function encodeMultipart(form: FormData, boundary: string): Promise<Loaded> {
	const chunks: Uint8Array[] = [];
	for (const [name, value] of form) {
		const disposition = `--${boundary}\r\nContent-Disposition: form-data; name="${escapeName(crlf(name))}"`;
		if (typeof value === "string") {
			chunks.push(utf8(`${disposition}\r\n\r\n${crlf(value)}\r\n`));
			continue;
		}
		const type = value.type || "application/octet-stream";
		chunks.push(
			utf8(`${disposition}; filename="${escapeName(value.name)}"\r\nContent-Type: ${type}\r\n\r\n`),
			new Uint8Array(await value.arrayBuffer()),
			utf8("\r\n"),
		);
	}
	// A form without entries is an empty body (Fetch § 5.1 "extract a body").
	if (chunks.length > 0) chunks.push(utf8(`--${boundary}--\r\n`));
	const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
	let at = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, at);
		at += chunk.length;
	}
	return record({ bytes });
}

/** How much of an untrusted multipart body `decodeMultipart` reads before it refuses it. */
export interface MultipartLimits {
	/** The most parts a body may have. */
	parts: number;
	/** The most bytes of headers one part may have. */
	headerBytes: number;
}

/**
 * The defaults: a thousand parts, which is PHP's `max_input_vars` and far past any form a person
 * fills in; and 16 KiB of headers a part, where a real part's disposition and type take well under
 * one. A body past either is refused before its parts are made, so a hostile server can't make the
 * thread build a million entries.
 */
export const MULTIPART_LIMITS: MultipartLimits = { parts: 1000, headerBytes: 16_384 };

const CR = 0x0d;
const LF = 0x0a;
const DASH = 0x2d;

/** Where `needle` is in `haystack` from `from`, or -1. */
function find(haystack: Uint8Array, needle: Uint8Array, from: number): number {
	const first = needle[0]!;
	const last = haystack.length - needle.length;
	for (let at = haystack.indexOf(first, from); at !== -1 && at <= last;) {
		let index = 1;
		while (index < needle.length && haystack[at + index] === needle[index]) index++;
		if (index === needle.length) return at;
		at = haystack.indexOf(first, at + 1);
	}
	return -1;
}

/** The `boundary` of a multipart/form-data `Content-Type`, or `undefined`. */
function boundaryOf(contentType: string): string | undefined {
	const [essence, ...parameters] = contentType.split(";");
	if (essence?.trim().toLowerCase() !== "multipart/form-data") return undefined;
	for (const parameter of parameters) {
		const equals = parameter.indexOf("=");
		if (equals === -1 || parameter.slice(0, equals).trim().toLowerCase() !== "boundary") continue;
		let value = parameter.slice(equals + 1).trim();
		if (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
			value = value.slice(1, -1);
		return value === "" ? undefined : value;
	}
	return undefined;
}

/** A name or file name read from a part's header: the escapes `escapeName` writes undone. */
function unescapeName(text: string): string {
	return text.replace(/%0A/g, "\n").replace(/%0D/g, "\r").replace(/%22/g, '"');
}

/** A header's parameters (`name="a"; filename="b"`), by lowercased name. */
function parametersOf(header: string): Map<string, string> {
	const found = new Map<string, string>();
	const pattern = /;\s*([^\s=;]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*))/g;
	for (let match = pattern.exec(header); match !== null; match = pattern.exec(header))
		found.set(
			match[1]!.toLowerCase(),
			match[2] === undefined ? match[3]!.trim() : match[2].replace(/\\(.)/g, "$1"),
		);
	return found;
}

/**
 * The `FormData` a multipart/form-data body holds (RFC 7578), its file parts the thread's `File`s.
 * Throws a `TypeError` for a body that is not one, and for one past `limits`.
 */
export function decodeMultipart(
	scope: Scope,
	bytes: Uint8Array,
	contentType: string,
	limits: Partial<MultipartLimits> = {},
): FormData {
	const { parts: maxParts, headerBytes: maxHeaderBytes } = { ...MULTIPART_LIMITS, ...limits };
	const boundary = boundaryOf(contentType);
	if (boundary === undefined)
		throw new TypeError(
			`The body's Content-Type, "${contentType}", is not multipart/form-data with a boundary.`,
		);
	// Boundary: the thread's `FormData`, `File` and `TextDecoder`, this folder's or an engine's.
	const form = new (scope["FormData"] as FormDataClass)();
	const FileClass = scope["File"] as FileClass;
	const decoder = new (scope["TextDecoder"] as TextDecoderClass)();
	const delimiter = utf8(`--${boundary}`);
	const next = utf8(`\r\n--${boundary}`);
	const malformed = (what: string): TypeError =>
		new TypeError(`The multipart/form-data body is malformed: ${what}.`);

	let at = find(bytes, delimiter, 0);
	if (at === -1) throw malformed("it has no boundary line");
	at += delimiter.length;
	let count = 0;
	for (;;) {
		if (bytes[at] === DASH && bytes[at + 1] === DASH) return form;
		// Transport padding (RFC 2046 § 5.1.1) may follow a boundary before its line break.
		while (bytes[at] === 0x20 || bytes[at] === 0x09) at++;
		if (bytes[at] !== CR || bytes[at + 1] !== LF) throw malformed("a boundary line runs on");
		at += 2;
		if (++count > maxParts)
			throw new TypeError(
				`The multipart/form-data body has more than ${maxParts} parts, the most it may have.`,
			);
		const headersEnd = find(
			bytes.subarray(0, Math.min(bytes.length, at + maxHeaderBytes + 4)),
			utf8("\r\n\r\n"),
			at - 2,
		);
		if (headersEnd === -1) {
			if (bytes.length - at > maxHeaderBytes)
				throw new TypeError(
					`A part of the multipart/form-data body has more than ${maxHeaderBytes} bytes of headers, the most it may have.`,
				);
			throw malformed("a part's headers never end");
		}
		const headers = new Map<string, string>();
		const headerText = headersEnd < at ? "" : decoder.decode(bytes.subarray(at, headersEnd));
		for (const line of headerText.split("\r\n")) {
			if (line === "") continue;
			const colon = line.indexOf(":");
			if (colon === -1) throw malformed("a header line has no colon");
			headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
		}
		const bodyStart = headersEnd + 4;
		const bodyEnd = find(bytes, next, bodyStart);
		if (bodyEnd === -1) throw malformed("a part never ends");
		const disposition = headers.get("content-disposition");
		if (disposition === undefined || !/^form-data\s*(;|$)/i.test(disposition))
			throw malformed("a part has no Content-Disposition of form-data");
		const parameters = parametersOf(disposition);
		const escapedName = parameters.get("name");
		if (escapedName === undefined) throw malformed("a part has no name");
		const name = unescapeName(escapedName);
		// Boundary: a view of the body's own buffer, which `Blob` copies.
		const body = bytes.subarray(bodyStart, bodyEnd) as Uint8Array<ArrayBuffer>;
		const filename = parameters.get("filename");
		if (filename === undefined) form.append(name, decoder.decode(body));
		else
			form.append(
				name,
				new FileClass([body], unescapeName(filename), {
					type: headers.get("content-type") ?? "text/plain",
				}),
			);
		at = bodyEnd + next.length;
	}
}
