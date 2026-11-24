// `CompressionStream` and `DecompressionStream`: the Compression Streams standard, § 5 "Interface
// CompressionStream" and § 6 "Interface DecompressionStream", over fflate's DEFLATE and the
// thread's `TransformStream`. Background only, with the streams. Experimental, and not in the
// baseline: `@sohedra/lynx-polyfill/compression` installs it.
//
// fflate's own gzip and zlib decompressors read past what the standard refuses (a wrong checksum,
// a stream cut short, bytes after the end), so this reads their headers and checksums itself
// (RFC 1950, RFC 1952) around fflate's raw DEFLATE (RFC 1951), and refuses each of those with a
// `TypeError`, as the standard says. A gzip stream is one member: a second is bytes after the end,
// as in Chrome and Node. Untrusted data is held to a maximum size per stream
// (`MAX_DECOMPRESSED_SIZE`, the output and a gzip header's bytes), past which the stream errors with
// a `RangeError`; input is decompressed in slices, so the check comes before the output grows much
// past it. A gzip header is read as it arrives, each byte once, and one longer than
// `MAX_GZIP_HEADER_SIZE` is refused with a `TypeError`.
//
// Leaves out: the `brotli` format, which fflate has no code for; a zlib stream with a preset
// dictionary, which the standard has no way to give.

import { experimental } from "../experimental.ts";
import type { Scope } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { Deflate, Gzip, Inflate, Zlib } from "../vendor/compression.js";
import type { OnData } from "../vendor/compression.js";
import type {
	CompressionStreamClass,
	DecompressionStreamClass,
	TransformStreamClass,
} from "./standard-classes.ts";

/**
 * The most bytes a `DecompressionStream` gives before it errors: 64 MiB. Far above a response
 * body a phone's app handles in memory, and far below what a small hostile input (DEFLATE expands
 * up to about 1,000 times) would take a background thread to.
 */
export const MAX_DECOMPRESSED_SIZE: number = 64 * 1024 * 1024;

/**
 * The longest gzip header a `DecompressionStream` reads: 64 KiB. Its optional fields (an extra
 * field, a file name, a comment) are a few bytes in what any tool writes.
 */
export const MAX_GZIP_HEADER_SIZE: number = 64 * 1024;

/** The limits a thread's classes hold untrusted data to. */
interface CompressionLimits {
	/** The most bytes one `DecompressionStream` gives: `MAX_DECOMPRESSED_SIZE` when left out. */
	maxDecompressedSize?: number;
}

/** @workaround web-compression-streams kind=lynx-gap delete-when="Lynx's background thread has CompressionStream and DecompressionStream" */
export function fillCompression(scope: Scope): void {
	let made: ReturnType<typeof createCompression> | undefined;
	const make = () => (made ??= createCompression(scope));
	for (const name of ["CompressionStream", "DecompressionStream"] as const)
		installLazy(
			scope,
			name,
			experimental(MODULE, name, () => make()[name]),
			isFunction,
		);
}

/** The import that installs this fill. */
const MODULE = "@sohedra/lynx-polyfill/compression";

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** The standard's `CompressionFormat`, but `brotli`. */
type Format = "gzip" | "deflate" | "deflate-raw";

const FORMATS: readonly string[] = ["gzip", "deflate", "deflate-raw"];

/** WebIDL's enum conversion of a format: its text, which must be one of the formats. */
function formatOf(format: unknown, what: string): Format {
	const name = `${format as string}`;
	if (!FORMATS.includes(name))
		throw new TypeError(
			`${what} can't use the format "${name}": it takes "gzip", "deflate" or "deflate-raw".`,
		);
	// Boundary: checked against the list above.
	return name as Format;
}

/** The bytes of a chunk, which must be a `BufferSource`: an `ArrayBuffer` or a view of one. */
function chunkBytes(chunk: unknown, what: string): Uint8Array {
	const tag = (value: unknown): string => Object.prototype.toString.call(value);
	if (tag(chunk) === "[object ArrayBuffer]") return new Uint8Array(chunk as ArrayBuffer);
	if (ArrayBuffer.isView(chunk) && tag(chunk.buffer) === "[object ArrayBuffer]")
		return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
	throw new TypeError(`${what} takes chunks of bytes: an ArrayBuffer or a view of one.`);
}

/** The stream each of these classes' `readable` and `writable` are. */
const transforms = new WeakMap<object, TransformStream>();

/** The streams' `readable` and `writable`: the standard's `GenericTransformStream`, a mixin. */
const GENERIC_TRANSFORM_STREAM: PropertyDescriptorMap = {
	readable: {
		get(this: object): ReadableStream {
			return own(this).readable;
		},
		enumerable: true,
		configurable: true,
	},
	writable: {
		get(this: object): WritableStream {
			return own(this).writable;
		},
		enumerable: true,
		configurable: true,
	},
};

function own(stream: object): TransformStream {
	const found = transforms.get(stream);
	if (!found) throw new TypeError("Illegal invocation: not a compression stream.");
	return found;
}

/** The thread's `CompressionStream` and `DecompressionStream`, over its `TransformStream`. */
export function createCompression(
	scope: Scope,
	{ maxDecompressedSize = MAX_DECOMPRESSED_SIZE }: CompressionLimits = {},
): {
	CompressionStream: CompressionStreamClass;
	DecompressionStream: DecompressionStreamClass;
} {
	/** A `TransformStream` of the thread's, running `transformer`. */
	const transformOf = (transformer: Transformer<unknown, Uint8Array>): TransformStream =>
		// Boundary: the thread's `TransformStream`, this folder's or an engine's.
		new (scope["TransformStream"] as TransformStreamClass)(transformer);

	class CompressionStreamFill {
		constructor(format: Format) {
			const kind = formatOf(format, "CompressionStream");
			const options = { mtime: 0 };
			const compressor =
				kind === "gzip"
					? new Gzip(options)
					: kind === "deflate"
						? new Zlib(options)
						: new Deflate(options);
			let output: Uint8Array[] = [];
			compressor.ondata = (data) => {
				if (data.length > 0) output.push(data);
			};
			const drain = (controller: TransformStreamDefaultController<Uint8Array>): void => {
				for (const data of output) controller.enqueue(data);
				output = [];
			};
			transforms.set(
				this,
				transformOf({
					transform(chunk, controller) {
						compressor.push(chunkBytes(chunk, "CompressionStream"), false);
						drain(controller);
					},
					flush(controller) {
						compressor.push(new Uint8Array(0), true);
						drain(controller);
					},
				}),
			);
		}
	}

	class DecompressionStreamFill {
		constructor(format: Format) {
			const decoder = createDecoder(formatOf(format, "DecompressionStream"), maxDecompressedSize);
			transforms.set(
				this,
				transformOf({
					transform(chunk, controller) {
						decoder.push(chunkBytes(chunk, "DecompressionStream"), (data) =>
							controller.enqueue(data),
						);
					},
					flush() {
						decoder.finish();
					},
				}),
			);
		}
	}

	for (const Class of [CompressionStreamFill, DecompressionStreamFill])
		Object.defineProperties(Class.prototype, GENERIC_TRANSFORM_STREAM);
	return {
		// Boundary: the classes above, as TypeScript's DOM library types them.
		CompressionStream: named(
			CompressionStreamFill,
			"CompressionStream",
		) as unknown as CompressionStreamClass,
		DecompressionStream: named(
			DecompressionStreamFill,
			"DecompressionStream",
		) as unknown as DecompressionStreamClass,
	};
}

/** How much compressed input goes to fflate at once: its output from it is at most ~4 MiB. */
const SLICE = 4096;

const EMPTY: Uint8Array = new Uint8Array(0);

function joined(first: Uint8Array, second: Uint8Array): Uint8Array {
	if (first.length === 0) return second;
	const both = new Uint8Array(first.length + second.length);
	both.set(first);
	both.set(second, first.length);
	return both;
}

/** What of fflate's `Inflate` this reads to see where the DEFLATE data ends (fflate 0.8.3). */
interface InflateState {
	/** The input it has not used yet. */
	p: Uint8Array;
	/** `f`: the last block has begun; `l`: a block is unfinished; `p`: the bit it is at in `p`. */
	s: { f?: number; l?: unknown; p?: number };
}

/** A decompressor of one format: gives the output of each input, and checks the end. */
function createDecoder(
	format: Format,
	limit: number,
): { push(input: Uint8Array, emit: (data: Uint8Array) => void): void; finish(): void } {
	let phase: "header" | "body" | "trailer" | "done" = format === "deflate-raw" ? "body" : "header";
	/** The bytes of a zlib header or a trailer not yet whole. */
	let pending = EMPTY;
	let size = 0;
	/** The bytes of the gzip header read so far, which count toward the limit too. */
	let headerSize = 0;
	let checksum = format === "gzip" ? CRC32_START : 1;
	const inflate = new Inflate();
	// Boundary: fflate's fields, pinned by its exact version.
	const state = inflate as unknown as InflateState;
	let emit: (data: Uint8Array) => void = () => {};
	const ondata: OnData = (data) => {
		if (data.length === 0) return;
		size += data.length;
		if (size + headerSize > limit)
			throw new RangeError(
				`DecompressionStream stopped at its limit of ${limit} decompressed bytes: the data holds more.`,
			);
		checksum = format === "gzip" ? crc32(checksum, data) : adler32(checksum, data);
		emit(data);
	};
	inflate.ondata = ondata;

	const invalid = (why: string): TypeError =>
		new TypeError(`DecompressionStream was given data that is not ${format}: ${why}.`);

	const readGzipHeader = gzipHeaderReader();

	const step = (input: Uint8Array): Uint8Array => {
		if (phase === "header") {
			let rest: Uint8Array | undefined;
			if (format === "gzip") rest = readGzipHeader(input);
			else {
				pending = joined(pending, input);
				const length = zlibHeaderLength(pending);
				if (length !== undefined) rest = pending.subarray(length);
			}
			if (rest === undefined) return EMPTY;
			pending = EMPTY;
			phase = "body";
			return rest;
		}
		if (phase === "body") {
			const slice = input.subarray(0, SLICE);
			try {
				inflate.push(slice, false);
			} catch (error) {
				if (error instanceof RangeError) throw error;
				throw invalid((error as Error).message);
			}
			const rest = input.subarray(slice.length);
			if (!state.s.f || state.s.l) return rest;
			// The data has ended, at a bit of the first byte `p` keeps; what follows is the trailer's.
			const after = state.p.subarray(state.s.p ? 1 : 0);
			phase = format === "deflate-raw" ? "done" : "trailer";
			return joined(after.slice(), rest);
		}
		if (phase === "trailer") {
			pending = joined(pending, input);
			const length = format === "gzip" ? 8 : 4;
			if (pending.length < length) return EMPTY;
			const trailer = pending;
			pending = EMPTY;
			if (format === "gzip") {
				if (readUint32(trailer, 0, true) !== (checksum ^ CRC32_START) >>> 0)
					throw invalid("its checksum is wrong");
				if (readUint32(trailer, 4, true) !== size >>> 0) throw invalid("its size is wrong");
			} else if (readUint32(trailer, 0, false) !== checksum >>> 0)
				throw invalid("its checksum is wrong");
			phase = "done";
			return trailer.subarray(length);
		}
		if (input.length > 0) throw invalid("there are bytes after its end");
		return EMPTY;
	};

	return {
		push(input, given) {
			emit = given;
			let rest = input;
			while (rest.length > 0) rest = step(rest);
		},
		finish() {
			if (phase !== "done") throw invalid("it ends before its data does");
		},
	};

	/**
	 * A reader of a gzip header (RFC 1952 § 2.3) as its bytes arrive, each read once: given the
	 * next input, it gives what follows the header, or `undefined` while the header goes on.
	 */
	function gzipHeaderReader(): (input: Uint8Array) => Uint8Array | undefined {
		const fixed = new Uint8Array(10);
		let field: GzipField = "fixed";
		/** The bytes the field has left, for a field of known length. */
		let left = fixed.length;
		/** The value read so far of a little-endian field: the extra field's length, the checksum. */
		let value = 0;
		let crc = CRC32_START;
		const table = crcTableOf();
		/** The field after `after` (the extra field's comes after its length), among those the header's flags give it. */
		const next = (after: GzipField): GzipField => {
			const flags = fixed[3]!;
			for (const [name, flag] of GZIP_FIELDS.slice(GZIP_FIELDS.findIndex(([f]) => f === after) + 1))
				if (flags & flag) return name;
			return "done";
		};
		const enter = (entered: GzipField): void => {
			field = entered;
			value = 0;
			left = entered === "extraLength" || entered === "headerChecksum" ? 2 : 0;
		};
		return (input) => {
			for (let at = 0; at < input.length; at++) {
				const byte = input[at]!;
				headerSize++;
				if (headerSize > MAX_GZIP_HEADER_SIZE)
					throw invalid(`its header is longer than ${MAX_GZIP_HEADER_SIZE} bytes`);
				if (headerSize > limit)
					throw new RangeError(
						`DecompressionStream stopped at its limit of ${limit} decompressed bytes: the data holds more.`,
					);
				if (field !== "headerChecksum") crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
				switch (field) {
					case "fixed":
						fixed[fixed.length - left] = byte;
						if (--left > 0) continue;
						if (fixed[0] !== 0x1f || fixed[1] !== 0x8b) throw invalid("its header is not gzip's");
						if (fixed[2] !== 8) throw invalid("its method is not DEFLATE");
						if (fixed[3]! & 0xe0) throw invalid("its header has reserved flags");
						enter(next("fixed"));
						break;
					case "extraLength":
						value |= byte << (8 * (2 - left));
						if (--left > 0) continue;
						left = value;
						field = "extra";
						if (left === 0) enter(next("extraLength"));
						break;
					case "extra":
						if (--left === 0) enter(next("extraLength"));
						break;
					case "name":
					case "comment":
						if (byte === 0) enter(next(field));
						break;
					case "headerChecksum":
						value |= byte << (8 * (2 - left));
						if (--left > 0) continue;
						if (value !== ((crc ^ CRC32_START) & 0xffff))
							throw invalid("its header checksum is wrong");
						field = "done";
						break;
					// "done" is never read: the header gives back the input from there.
				}
				if (field === "done") return input.subarray(at + 1);
			}
			return undefined;
		};
	}

	/** The length of a zlib header (RFC 1950 § 2.2), `undefined` until it is whole. */
	function zlibHeaderLength(bytes: Uint8Array): number | undefined {
		if (bytes.length < 2) return undefined;
		const [method, flags] = [bytes[0]!, bytes[1]!];
		if ((method & 0x0f) !== 8 || method >> 4 > 7 || ((method << 8) | flags) % 31 !== 0)
			throw invalid("its header is not zlib's");
		if (flags & 0x20) throw invalid("it needs a preset dictionary");
		return 2;
	}
}

function readUint32(bytes: Uint8Array, at: number, littleEndian: boolean): number {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, littleEndian);
}

/** A gzip header's fields, in order: a field with a flag is there when the header's flags have it. */
type GzipField = "fixed" | "extraLength" | "extra" | "name" | "comment" | "headerChecksum" | "done";

/** The optional fields and their flags (RFC 1952 § 2.3.1: `FEXTRA`, `FNAME`, `FCOMMENT`, `FHCRC`). */
const GZIP_FIELDS: readonly (readonly [GzipField, number])[] = [
	["fixed", 0],
	["extraLength", 4],
	["name", 8],
	["comment", 16],
	["headerChecksum", 2],
];

const CRC32_START = 0xffffffff;

/** CRC-32's table (ISO 3309, as gzip's trailer uses it), made on first use. */
let crcTable: Int32Array | undefined;

function crcTableOf(): Int32Array {
	if (crcTable) return crcTable;
	crcTable = new Int32Array(256);
	for (let index = 0; index < 256; index++) {
		let value = index;
		for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		crcTable[index] = value;
	}
	return crcTable;
}

/** `crc` carried over `data`, before its final inversion. */
function crc32(crc: number, data: Uint8Array): number {
	const table = crcTableOf();
	let value = crc;
	for (let index = 0; index < data.length; index++)
		value = table[(value ^ data[index]!) & 0xff]! ^ (value >>> 8);
	return value >>> 0;
}

/** Adler-32 (RFC 1950 § 8) carried over `data`. */
function adler32(adler: number, data: Uint8Array): number {
	let a = adler & 0xffff;
	let b = adler >>> 16;
	for (let start = 0; start < data.length; start += 5552) {
		const end = Math.min(start + 5552, data.length);
		for (let index = start; index < end; index++) {
			a += data[index]!;
			b += a;
		}
		a %= 65521;
		b %= 65521;
	}
	return ((b << 16) | a) >>> 0;
}
