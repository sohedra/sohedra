// The types of compression.js, which scripts/polyfill/bundle.ts writes from fflate.

/** Takes each piece of output, and whether it is the last. */
export type OnData = (data: Uint8Array, final: boolean) => void;

/** A streaming compressor or decompressor: give it input with `push`, read output in `ondata`. */
interface Stream {
	ondata: OnData;
	/** Takes the next piece of input; `final` for the last. Throws on input it can't read. */
	push(chunk: Uint8Array, final?: boolean): void;
}

/** The options of a compressor. */
export interface CompressOptions {
	/** 0 to 9; 6 when left out. */
	level?: number;
	/** A gzip header's modification time; 0 writes none. */
	mtime?: number;
}

/** Raw DEFLATE (RFC 1951). */
export class Deflate implements Stream {
	constructor(options?: CompressOptions);
	ondata: OnData;
	push(chunk: Uint8Array, final?: boolean): void;
}

/** DEFLATE in gzip's framing (RFC 1952). */
export class Gzip implements Stream {
	constructor(options?: CompressOptions);
	ondata: OnData;
	push(chunk: Uint8Array, final?: boolean): void;
}

/** DEFLATE in zlib's framing (RFC 1950). */
export class Zlib implements Stream {
	constructor(options?: CompressOptions);
	ondata: OnData;
	push(chunk: Uint8Array, final?: boolean): void;
}

/** Raw DEFLATE's decompressor. */
export class Inflate implements Stream {
	constructor();
	ondata: OnData;
	push(chunk: Uint8Array, final?: boolean): void;
}
