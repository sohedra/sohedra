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
	const number = Math.trunc(Number(value)) || 0;
	return number < 0 ? Math.max(size + number, 0) : Math.min(number, size);
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

	/** The bytes of `parts` joined, copied: the File API's "process blob parts". */
	const join = (parts: unknown, endings: string): Uint8Array => {
		if (parts === undefined) return new Uint8Array(0);
		if (
			typeof parts !== "object" ||
			parts === null ||
			typeof (parts as Iterable<unknown>)[Symbol.iterator] !== "function"
		)
			throw new TypeError("Blob takes a list of parts: strings, ArrayBuffers, views and Blobs.");
		const chunks: Uint8Array[] = [];
		let size = 0;
		for (const part of parts as Iterable<unknown>) {
			let bytes: Uint8Array;
			const held = typeof part === "object" && part !== null ? blobs.get(part) : undefined;
			if (held) bytes = held.bytes;
			else if (part instanceof ArrayBuffer || ArrayBuffer.isView(part))
				bytes = bytesOf(part, "Blob");
			else {
				const text = `${part as string}`;
				bytes = encode(endings === "native" ? nativeEndings(text) : text);
			}
			chunks.push(bytes);
			size += bytes.length;
		}
		const joined = new Uint8Array(size);
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
		// Boundary: an options dictionary, read by name.
		const { type, endings } = options as { type?: unknown; endings?: unknown };
		const ending = endings === undefined ? "transparent" : `${endings as string}`;
		if (ending !== "transparent" && ending !== "native")
			throw new TypeError(`Blob's endings is "transparent" or "native", not "${ending}".`);
		return { type: type === undefined ? "" : typeOf(type), endings: ending };
	};

	let sliced: BlobFields | undefined;

	class BlobFill {
		constructor(parts?: unknown, options?: unknown) {
			if (sliced) {
				blobs.set(this, sliced);
				sliced = undefined;
				return;
			}
			const { type, endings } = optionsOf(options);
			blobs.set(this, { bytes: join(parts, endings), type });
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
			// Boundary: the thread's `ReadableStream`, this folder's or an engine's.
			return new (scope["ReadableStream"] as ReadableStreamClass)<Uint8Array>({
				pull(controller) {
					if (at >= bytes.length) {
						controller.close();
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
