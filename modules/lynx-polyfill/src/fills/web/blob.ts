// `Blob` and `File`: the File API § 3 "The Blob interface and binary data" and § 4 "The File
// interface". The background lacks both; `fetch`'s bodies and `FormData`'s files are made of them.
// Background only, as the brief's table says. In memory: a blob holds a copy of its bytes, made as
// it is constructed. Leaves out files on the device (no `File` reads a path) and `blob:` URLs.

import type { Scope } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { bytesOf } from "./encoding.ts";
import type {
	BlobClass,
	FileClass,
	ReadableStreamClass,
	TextDecoderClass,
	TextEncoderClass,
} from "./standard-classes.ts";

/** @workaround web-blob kind=lynx-gap delete-when="Lynx's background thread has global Blob and File" */
export function fillBlob(scope: Scope): void {
	let made: ReturnType<typeof createBlob> | undefined;
	const make = () => (made ??= createBlob(scope));
	installLazy(scope, "Blob", () => make().Blob, isFunction);
	installLazy(scope, "File", () => make().File, isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** How many bytes each chunk of a blob's `stream()` holds. */
const CHUNK = 65_536;

/** What a blob holds. */
interface BlobFields {
	bytes: Uint8Array;
	type: string;
}

/** What a file holds besides its bytes. */
interface FileFields {
	name: string;
	lastModified: number;
}

/** A blob's `type`: lowercased, or `""` where it has a character outside printable ASCII. */
function typeOf(type: unknown): string {
	const text = `${type as string}`;
	return /^[\x20-\x7E]*$/.test(text) ? text.toLowerCase() : "";
}

/** WebIDL's `[Clamp] long long` for an offset given to `slice`, relative to `size` when negative. */
function offset(value: unknown, size: number, fallback: number): number {
	if (value === undefined) return fallback;
	const number = clamped(Number(value));
	return number < 0 ? Math.max(size + number, 0) : Math.min(number, size);
}

/** Web IDL § 3.2.4.4 `[Clamp]`: NaN as 0, else to the nearest integer, a tie to the even one. */
function clamped(number: number): number {
	if (Number.isNaN(number)) return 0;
	const floor = Math.floor(number);
	const rest = number - floor;
	if (rest < 0.5) return floor + 0;
	if (rest > 0.5) return floor + 1;
	return floor % 2 === 0 ? floor + 0 : floor + 1;
}

/** Line breaks made `\n`, as `endings: "native"` asks on Lynx's platforms. */
function nativeEndings(text: string): string {
	return text.replace(/\r\n?/g, "\n");
}

/** The thread's `Blob` and `File`, in memory. */
export function createBlob(scope: Scope): { Blob: BlobClass; File: FileClass } {
	const blobs = new WeakMap<object, BlobFields>();
	const files = new WeakMap<object, FileFields>();
	const fieldsOf = (blob: unknown): BlobFields => {
		const found = typeof blob === "object" && blob !== null ? blobs.get(blob) : undefined;
		if (!found) throw new TypeError("Illegal invocation: not a Blob.");
		return found;
	};
	const fileOf = (file: unknown): FileFields => {
		const found = typeof file === "object" && file !== null ? files.get(file) : undefined;
		if (!found) throw new TypeError("Illegal invocation: not a File.");
		return found;
	};

	/** UTF-8 of `text`, each lone surrogate made U+FFFD, by the thread's `TextEncoder`. */
	const encode = (text: string): Uint8Array =>
		// Boundary: the thread's `TextEncoder`, this folder's or an engine's.
		new (scope["TextEncoder"] as TextEncoderClass)().encode(text);

	/**
	 * Web IDL's conversion of `parts` to a `sequence<BlobPart>`, as the constructor's first step:
	 * its iterator read once, each part made bytes or text in turn, before the options are read.
	 */
	const partsOf = (parts: unknown): (Uint8Array | string)[] => {
		if (parts === undefined) return [];
		if (typeof parts !== "object" || parts === null)
			throw new TypeError("Blob takes a list of parts: strings, ArrayBuffers, views and Blobs.");
		// Boundary: an iterable, read as Web IDL reads a sequence.
		const method = (parts as { [Symbol.iterator]?: unknown })[Symbol.iterator];
		if (typeof method !== "function")
			throw new TypeError("Blob takes a list of parts: strings, ArrayBuffers, views and Blobs.");
		const iterator = (method as () => Iterator<unknown>).call(parts);
		const items: (Uint8Array | string)[] = [];
		for (let step = iterator.next(); !step.done; step = iterator.next()) {
			const part = step.value;
			const held = typeof part === "object" && part !== null ? blobs.get(part) : undefined;
			if (held) items.push(held.bytes);
			else if (part instanceof ArrayBuffer || ArrayBuffer.isView(part))
				items.push(bytesOf(part, "Blob"));
			else items.push(`${part as string}`);
		}
		return items;
	};

	/** The parts' bytes joined, copied, text with its `endings`: the File API's "process blob parts". */
	const join = (items: readonly (Uint8Array | string)[], endings: string): Uint8Array => {
		const chunks = items.map((item) =>
			typeof item === "string" ? encode(endings === "native" ? nativeEndings(item) : item) : item,
		);
		const joined = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
		let at = 0;
		for (const chunk of chunks) {
			joined.set(chunk, at);
			at += chunk.length;
		}
		return joined;
	};

	/** A blob's options: its `type`, and how its strings' line breaks are written. */
	const optionsOf = (options: unknown): { type: string; endings: string } => {
		if (options === undefined || options === null) return { type: "", endings: "transparent" };
		if (typeof options !== "object" && typeof options !== "function")
			throw new TypeError("Blob takes its options as an object.");
		// Boundary: an options dictionary, read by name in Web IDL's order: lexicographic.
		const { endings, type } = options as { type?: unknown; endings?: unknown };
		const ending = endings === undefined ? "transparent" : `${endings as string}`;
		if (ending !== "transparent" && ending !== "native")
			throw new TypeError(`Blob's endings is "transparent" or "native", not "${ending}".`);
		return { type: type === undefined ? "" : typeOf(type), endings: ending };
	};

	let sliced: BlobFields | undefined;

	class BlobFill {
		// Both arguments optional, as Web IDL's are: the class's `length` is 0.
		constructor(...args: [parts?: unknown, options?: unknown]) {
			const [parts, options] = args;
			if (sliced) {
				blobs.set(this, sliced);
				sliced = undefined;
				return;
			}
			const items = partsOf(parts);
			const { type, endings } = optionsOf(options);
			blobs.set(this, { bytes: join(items, endings), type });
		}

		get size(): number {
			return fieldsOf(this).bytes.length;
		}

		get type(): string {
			return fieldsOf(this).type;
		}

		slice(start?: number, end?: number, contentType?: string): Blob {
			const { bytes } = fieldsOf(this);
			const from = offset(start, bytes.length, 0);
			const to = offset(end, bytes.length, bytes.length);
			sliced = {
				// The bytes are never written after construction, so a slice may share them.
				bytes: bytes.subarray(from, Math.max(from, to)),
				type: contentType === undefined ? "" : typeOf(contentType),
			};
			// Boundary: the class above, as TypeScript's DOM library types it.
			return new BlobFill() as unknown as Blob;
		}

		text(): Promise<string> {
			const { bytes } = fieldsOf(this);
			// Boundary: the thread's `TextDecoder`, this folder's or an engine's.
			return Promise.resolve(new (scope["TextDecoder"] as TextDecoderClass)().decode(bytes));
		}

		arrayBuffer(): Promise<ArrayBuffer> {
			const { bytes } = fieldsOf(this);
			return Promise.resolve(bytes.slice().buffer);
		}

		bytes(): Promise<Uint8Array> {
			const { bytes } = fieldsOf(this);
			return Promise.resolve(bytes.slice());
		}

		stream(): ReadableStream<Uint8Array> {
			const { bytes } = fieldsOf(this);
			let at = 0;
			// A byte stream, as the File API's is, so a BYOB reader can read it.
			// Boundary: the thread's `ReadableStream`, this folder's or an engine's.
			return new (scope["ReadableStream"] as ReadableStreamClass)<Uint8Array>({
				type: "bytes",
				pull(controller) {
					if (at >= bytes.length) {
						controller.close();
						// A BYOB read waiting as the stream ends is answered done (Streams § 4.10.11).
						// Boundary: a byte stream's controller, as the source asked for.
						(controller as ReadableByteStreamController).byobRequest?.respond(0);
						return;
					}
					controller.enqueue(bytes.slice(at, at + CHUNK));
					at += CHUNK;
				},
			});
		}
	}

	class FileFill extends BlobFill {
		constructor(...args: [parts: unknown, name: unknown, options?: unknown]) {
			if (args.length < 2)
				throw new TypeError("File takes its parts and a name, and was given fewer.");
			const [parts, name, options] = args;
			super(parts, options);
			// Boundary: an options dictionary, read by name.
			const lastModified = (options as { lastModified?: unknown } | null | undefined)?.lastModified;
			files.set(this, {
				name: `${name as string}`,
				lastModified:
					lastModified === undefined ? Date.now() : Math.trunc(Number(lastModified)) || 0,
			});
		}

		get name(): string {
			return fileOf(this).name;
		}

		get lastModified(): number {
			return fileOf(this).lastModified;
		}

		get webkitRelativePath(): string {
			fileOf(this);
			return "";
		}
	}

	return {
		// Boundary: the File API's classes, as TypeScript's DOM library types them.
		Blob: named(BlobFill, "Blob") as unknown as BlobClass,
		File: named(FileFill, "File") as unknown as FileClass,
	};
}
