// `CompressionStream` and `DecompressionStream`, against the Compression Streams standard, with
// Node's own (which pass the web platform tests) and node:zlib as the reference.

import zlib from "node:zlib";

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import {
	createCompression,
	fillCompression,
	MAX_DECOMPRESSED_SIZE,
} from "../../src/fills/web/compression.ts";

const scope = { TransformStream } as Record<string, unknown>;
const { CompressionStream: Compression, DecompressionStream: Decompression } =
	createCompression(scope);

const FORMATS = ["gzip", "deflate", "deflate-raw"] as const;
type Format = (typeof FORMATS)[number];

/** node:zlib's one-shot functions, by format. */
const NODE = {
	gzip: { compress: zlib.gzipSync, decompress: zlib.gunzipSync },
	deflate: { compress: zlib.deflateSync, decompress: zlib.inflateSync },
	"deflate-raw": { compress: zlib.deflateRawSync, decompress: zlib.inflateRawSync },
};

/** What `stream` gives for `chunks` written one by one: its bytes, joined. */
async function run(
	stream: TransformStream,
	chunks: unknown[],
	{ checked = true } = {},
): Promise<Uint8Array> {
	const writer = stream.writable.getWriter();
	const written = (async () => {
		for (const chunk of chunks) await writer.write(chunk);
		await writer.close();
	})();
	// The readable's error is the one to report; the writable's is the same error again.
	written.catch(() => {});
	const parts: Uint8Array[] = [];
	const reader = stream.readable.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		// The standard enqueues no empty chunk; Node's does.
		if (checked) {
			expect(value).toBeInstanceOf(Uint8Array);
			expect((value as Uint8Array).length).toBeGreaterThan(0);
		}
		parts.push(value as Uint8Array);
	}
	await written;
	return new Uint8Array(Buffer.concat(parts));
}

/** What a stream ends with: its bytes, or the name and first line of its error. */
async function outcome(stream: TransformStream, chunks: unknown[]): Promise<unknown> {
	try {
		return { bytes: [...(await run(stream, chunks, { checked: false }))] };
	} catch (error) {
		return { error: (error as Error).name };
	}
}

/** `bytes` cut at `cuts`, as chunks. */
function split(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
	const points = [...new Set(cuts.map((cut) => cut % (bytes.length + 1)))].sort((a, b) => a - b);
	const chunks: Uint8Array[] = [];
	let start = 0;
	for (const point of [...points, bytes.length]) {
		chunks.push(bytes.slice(start, point));
		start = point;
	}
	return chunks;
}

const text = (bytes: Uint8Array): string => Buffer.from(bytes).toString();
const bytesOf = (value: string): Uint8Array => new Uint8Array(Buffer.from(value));

describe("CompressionStream", () => {
	it.each(FORMATS)(
		"writes %s that node:zlib reads, for any bytes in any chunks",
		async (format) => {
			await fc.assert(
				fc.asyncProperty(
					fc.uint8Array({ maxLength: 3000 }),
					fc.array(fc.nat(), { maxLength: 6 }),
					async (data, cuts) => {
						const compressed = await run(new Compression(format), split(data, cuts));
						expect([...NODE[format].decompress(compressed)]).toEqual([...data]);
					},
				),
				{ numRuns: 60 },
			);
		},
	);

	it.each(FORMATS)(
		"writes %s of nothing, which Node's DecompressionStream reads",
		async (format) => {
			const compressed = await run(new Compression(format), []);
			const native = new DecompressionStream(format) as unknown as TransformStream;
			expect(await run(native, [compressed])).toEqual(new Uint8Array(0));
		},
	);

	it("writes a gzip header without a time, as browsers do", async () => {
		const compressed = await run(new Compression("gzip"), [bytesOf("a")]);
		expect([...compressed.subarray(0, 3)]).toEqual([0x1f, 0x8b, 8]);
		expect([...compressed.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
	});

	it("takes an ArrayBuffer, a typed array and a DataView", async () => {
		const data = bytesOf("abcdef");
		const chunks = [
			data.buffer.slice(0, 2),
			new Uint16Array(data.buffer.slice(2, 4)),
			new DataView(data.buffer, 4, 2),
		];
		expect(text(NODE.gzip.decompress(await run(new Compression("gzip"), chunks)))).toBe("abcdef");
	});

	it.each([["text"], [12], [null], [[1, 2]], [new SharedArrayBuffer(2)]])(
		"refuses a chunk that is not bytes, %j, with a TypeError",
		async (chunk) => {
			expect(await outcome(new Compression("gzip"), [chunk])).toEqual({ error: "TypeError" });
		},
	);
});

describe("DecompressionStream", () => {
	it.each(FORMATS)("reads what node:zlib writes as %s, in any chunks", async (format) => {
		await fc.assert(
			fc.asyncProperty(
				fc.uint8Array({ maxLength: 3000 }),
				fc.array(fc.nat(), { maxLength: 8 }),
				fc.integer({ min: 0, max: 9 }),
				async (data, cuts, level) => {
					const compressed = new Uint8Array(NODE[format].compress(data, { level }));
					expect([...(await run(new Decompression(format), split(compressed, cuts)))]).toEqual([
						...data,
					]);
				},
			),
			{ numRuns: 60 },
		);
	});

	it.each(FORMATS)("reads what it compressed as %s, one byte at a time", async (format) => {
		const data = bytesOf("The quick brown fox jumps over the lazy dog. ".repeat(40));
		const compressed = await run(new Compression(format), [data]);
		const decompressed = await run(
			new Decompression(format),
			split(compressed, [...compressed.keys()]),
		);
		expect(text(decompressed)).toBe(text(data));
	});

	it("reads a gzip header with an extra field, a name, a comment and a header checksum", async () => {
		const body = NODE["deflate-raw"].compress("named");
		const header = [0x1f, 0x8b, 8, 0b11110, 0, 0, 0, 0, 0, 3, 2, 0, 0xaa, 0xbb];
		header.push(...bytesOf("file.txt"), 0, ...bytesOf("a comment"), 0);
		const crc = zlib.crc32(new Uint8Array(header)) & 0xffff;
		const trailer = Buffer.alloc(8);
		trailer.writeUInt32LE(zlib.crc32("named"), 0);
		trailer.writeUInt32LE(5, 4);
		const member = Buffer.concat([
			Buffer.from(header),
			Buffer.from([crc & 0xff, crc >> 8]),
			body,
			trailer,
		]);
		expect(text(zlib.gunzipSync(member))).toBe("named");
		const chunks = split(new Uint8Array(member), [...member.keys()]);
		expect(text(await run(new Decompression("gzip"), chunks))).toBe("named");
	});

	/** Each case: what Node's DecompressionStream does with it is what this one must do. */
	const gzip = new Uint8Array(zlib.gzipSync("hello"));
	const deflate = new Uint8Array(zlib.deflateSync("hello"));
	const raw = new Uint8Array(zlib.deflateRawSync("hello"));
	const flipped = (bytes: Uint8Array, from: number): Uint8Array => {
		const copy = bytes.slice();
		copy[copy.length - from]! ^= 1;
		return copy;
	};
	const joined = (...parts: Uint8Array[]): Uint8Array => new Uint8Array(Buffer.concat(parts));
	const cases: [string, Format, Uint8Array][] = [
		["nothing as gzip", "gzip", new Uint8Array(0)],
		["nothing as deflate", "deflate", new Uint8Array(0)],
		["nothing as deflate-raw", "deflate-raw", new Uint8Array(0)],
		["two gzip members", "gzip", joined(gzip, new Uint8Array(zlib.gzipSync(" world")))],
		["gzip with bytes after it", "gzip", joined(gzip, bytesOf("x"))],
		["deflate with bytes after it", "deflate", joined(deflate, bytesOf("x"))],
		["deflate-raw with bytes after it", "deflate-raw", joined(raw, bytesOf("x"))],
		["gzip with a wrong checksum", "gzip", flipped(gzip, 6)],
		["gzip with a wrong size", "gzip", flipped(gzip, 1)],
		["deflate with a wrong checksum", "deflate", flipped(deflate, 1)],
		["gzip cut in its trailer", "gzip", gzip.slice(0, -1)],
		["gzip cut in its data", "gzip", gzip.slice(0, 12)],
		["deflate cut in its checksum", "deflate", deflate.slice(0, -2)],
		["deflate-raw cut short", "deflate-raw", raw.slice(0, 3)],
		["gzip with another method", "gzip", joined(new Uint8Array([0x1f, 0x8b, 7]), gzip.slice(3))],
		[
			"gzip's reserved flags",
			"gzip",
			joined(gzip.slice(0, 3), new Uint8Array([0x20]), gzip.slice(4)),
		],
		["deflate with a dictionary", "deflate", new Uint8Array([0x78, 0xbb, 0, 0, 0, 1, 3, 0])],
		["not compressed at all", "deflate", bytesOf("garbage!!")],
		["deflate-raw with a bad block type", "deflate-raw", new Uint8Array([0xff, 0xff])],
	];
	it.each(cases)("does with %s what Node's does", async (_name, format, bytes) => {
		const native = new DecompressionStream(format) as unknown as TransformStream;
		const expected = await outcome(native, [bytes]);
		expect(await outcome(new Decompression(format), [bytes])).toEqual(expected);
		expect(await outcome(new Decompression(format), split(bytes, [...bytes.keys()]))).toEqual(
			expected,
		);
	});

	it("refuses a chunk that is not bytes with a TypeError", async () => {
		expect(await outcome(new Decompression("gzip"), ["text"])).toEqual({ error: "TypeError" });
	});
});

describe("the untrusted-input limit", () => {
	it("is 64 MiB by default", () => {
		expect(MAX_DECOMPRESSED_SIZE).toBe(64 * 1024 * 1024);
	});

	it.each(FORMATS)(
		"stops %s past its limit with a RangeError, before holding much more",
		async (format) => {
			const { DecompressionStream: Limited } = createCompression(scope, {
				maxDecompressedSize: 100_000,
			});
			const bomb = new Uint8Array(NODE[format].compress(new Uint8Array(10_000_000)));
			const stream = new Limited(format) as unknown as TransformStream;
			const writer = stream.writable.getWriter();
			void writer.write(bomb).catch(() => {});
			const reader = stream.readable.getReader();
			let read = 0;
			let error: unknown;
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					read += (value as Uint8Array).length;
				}
			} catch (caught) {
				error = caught;
			}
			expect(error).toBeInstanceOf(RangeError);
			expect((error as Error).message.split("\n")[0]).toBe(
				"DecompressionStream stopped at its limit of 100000 decompressed bytes: the data holds more.",
			);
			expect(read).toBeLessThanOrEqual(100_000);
		},
	);

	it("reads data up to the limit exactly", async () => {
		const { DecompressionStream: Limited } = createCompression(scope, {
			maxDecompressedSize: 1000,
		});
		const data = new Uint8Array(1000).fill(7);
		const decompressed = await run(new Limited("gzip") as unknown as TransformStream, [
			new Uint8Array(zlib.gzipSync(data)),
		]);
		expect(decompressed.length).toBe(1000);
	});
});

describe("the classes", () => {
	it.each([[Compression], [Decompression]])(
		"%o refuses a format the standard lacks with a TypeError",
		(Class) => {
			for (const format of ["br", "brotli", "GZIP", undefined, ""])
				expect(() => new Class(format as Format)).toThrow(TypeError);
		},
	);

	it("name themselves, and give their streams and nothing else", () => {
		expect(Compression.name).toBe("CompressionStream");
		expect(Decompression.name).toBe("DecompressionStream");
		const stream = new Compression("gzip");
		expect(Object.prototype.toString.call(stream)).toBe("[object CompressionStream]");
		expect(stream.readable).toBeInstanceOf(ReadableStream);
		expect(stream.writable).toBeInstanceOf(WritableStream);
		expect(stream.readable).toBe(stream.readable);
		const getter = Object.getOwnPropertyDescriptor(Compression.prototype, "readable")!.get!;
		expect(() => getter.call({})).toThrow(TypeError);
	});

	it("go on the background's global object, made on first read, over its TransformStream", async () => {
		const thread: Record<string, unknown> = { TransformStream };
		fillCompression(thread);
		expect(Object.getOwnPropertyDescriptor(thread, "CompressionStream")?.get).toBeTypeOf(
			"function",
		);
		const Class = thread["CompressionStream"] as typeof CompressionStream;
		const compressed = await run(new Class("deflate") as unknown as TransformStream, [
			bytesOf("x"),
		]);
		expect(text(zlib.inflateSync(compressed))).toBe("x");
	});

	it("leave a thread's own", () => {
		const own = { CompressionStream, DecompressionStream };
		const thread: Record<string, unknown> = { ...own };
		fillCompression(thread);
		expect(thread).toEqual(own);
	});
});
