// `TextEncoderStream` and `TextDecoderStream`, the Encoding Standard's § 8.3 and § 8.4, over a
// thread's `TransformStream`, `TextEncoder` and `TextDecoder`: here Node's streams and this
// folder's encoders.

import { ReadableStream, TransformStream } from "node:stream/web";

import { describe, expect, it } from "@rstest/core";

import {
	createTextDecoderStream,
	createTextEncoderStream,
	fillEncodingStreams,
} from "../../src/fills/web/encoding-streams.ts";
import { createTextEncoding } from "../../src/fills/web/encoding.ts";

const scope: Record<string, unknown> = { TransformStream, ...createTextEncoding({}) };
const TextEncoderStream = createTextEncoderStream(scope);
const TextDecoderStream = createTextDecoderStream(scope);

/** What `chunks` give, piped through `stream`. */
async function through<T>(
	chunks: unknown[],
	stream: { readable: unknown; writable: unknown },
): Promise<T[]> {
	// Boundary: Node's streams, which the fills' `readable` and `writable` are.
	const source = ReadableStream.from(chunks).pipeThrough(
		stream as unknown as TransformStream<unknown, T>,
	);
	const out: T[] = [];
	for await (const chunk of source) out.push(chunk as T);
	return out;
}

describe("TextEncoderStream", () => {
	it("encodes each chunk as UTF-8", async () => {
		const out = await through<Uint8Array>(["a", "é€"], new TextEncoderStream());
		expect(out.map((chunk) => [...chunk])).toEqual([[0x61], [0xc3, 0xa9, 0xe2, 0x82, 0xac]]);
	});

	it("keeps a surrogate pair split over two chunks whole, and ends a lone one as U+FFFD", async () => {
		const out = await through<Uint8Array>(["a\uD83D", "\uDE00", "\uD83D"], new TextEncoderStream());
		expect(out.map((chunk) => [...chunk])).toEqual([
			[0x61],
			[0xf0, 0x9f, 0x98, 0x80],
			[0xef, 0xbf, 0xbd],
		]);
	});

	it("is utf-8, named as the standard's, and refuses a getter on anything else", () => {
		const stream = new TextEncoderStream();
		expect(stream.encoding).toBe("utf-8");
		expect(TextEncoderStream.name).toBe("TextEncoderStream");
		const readable = Object.getOwnPropertyDescriptor(
			Object.getPrototypeOf(TextEncoderStream.prototype),
			"readable",
		)!.get!;
		expect(() => readable.call({})).toThrow(TypeError);
	});
});

describe("TextDecoderStream", () => {
	it("decodes a character split over chunks at every point", async () => {
		const bytes = [0x61, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80];
		for (let at = 0; at <= bytes.length; at++) {
			const chunks = [new Uint8Array(bytes.slice(0, at)), new Uint8Array(bytes.slice(at))];
			const out = await through<string>(chunks, new TextDecoderStream());
			expect(out.join(""), `split at ${at}`).toBe("a€😀");
		}
	});

	it("ends an unfinished character as U+FFFD, or errors with fatal", async () => {
		expect(
			(await through<string>([new Uint8Array([0x61, 0xe2])], new TextDecoderStream())).join(""),
		).toBe("a�");
		await expect(
			through<string>([new Uint8Array([0xe2])], new TextDecoderStream("utf-8", { fatal: true })),
		).rejects.toThrow(TypeError);
	});

	it("has its decoder's options, and refuses another encoding", () => {
		const stream = new TextDecoderStream("utf8", { fatal: true, ignoreBOM: true });
		expect([stream.encoding, stream.fatal, stream.ignoreBOM]).toEqual(["utf-8", true, true]);
		expect(() => new TextDecoderStream("latin1")).toThrow(RangeError);
	});
});

describe("the fill", () => {
	it("puts both on a thread that lacks them, made on first read, and leaves a thread's own", () => {
		const bare: Record<string, unknown> = { ...scope };
		fillEncodingStreams(bare);
		expect(Object.getOwnPropertyDescriptor(bare, "TextDecoderStream")?.get).toBeTypeOf("function");
		expect((bare["TextEncoderStream"] as typeof TextEncoderStream).name).toBe("TextEncoderStream");
		const own: Record<string, unknown> = { TextEncoderStream: Object, TextDecoderStream: Object };
		fillEncodingStreams(own);
		expect(own).toEqual({ TextEncoderStream: Object, TextDecoderStream: Object });
	});
});

describe("TextDecoderStream's chunks", () => {
	it("refuses one that is no BufferSource, erroring both sides", async () => {
		for (const chunk of [undefined, null, 3.14, {}, [65]]) {
			const stream = new TextDecoderStream();
			const reader = stream.readable.getReader();
			const writer = stream.writable.getWriter();
			const outcomes = await Promise.allSettled([writer.write(chunk as never), reader.read()]);
			expect(
				outcomes.map(
					(outcome) => outcome.status === "rejected" && outcome.reason instanceof TypeError,
				),
				JSON.stringify(chunk) ?? "undefined",
			).toEqual([true, true]);
		}
	});
});
