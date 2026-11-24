// How fast the heavy fills are, as a floor a change must not fall through: the streams on 8 KB
// chunks (a fetched body's size on Lynx), fflate's compression streams, and URLPattern's matching.
// Measured in Node, which runs them several times faster than a phone's PrimJS; the limits are ten
// to twenty times what a laptop takes, so they catch an order-of-magnitude slowdown, not noise.

import { describe, expect, it } from "@rstest/core";

import * as streams from "../../src/fills/vendor/streams.js";
import { URLPattern } from "../../src/fills/vendor/url-pattern.js";
import { createCompression } from "../../src/fills/web/compression.ts";

const CHUNK = 8 * 1024;
const TOTAL = 16 * 1024 * 1024;

/** A stream of `TOTAL` bytes in `CHUNK`-sized chunks, of the fill's `ReadableStream`. */
function source(): ReadableStream<Uint8Array> {
	let sent = 0;
	const chunk = new Uint8Array(CHUNK).map((_, index) => index % 251);
	return new streams.ReadableStream<Uint8Array>({
		pull(controller) {
			if (sent >= TOTAL) controller.close();
			else {
				controller.enqueue(chunk.slice());
				sent += CHUNK;
			}
		},
	});
}

/** Reads `stream` to its end and returns how many bytes came through. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<number> {
	const reader = stream.getReader();
	let bytes = 0;
	for (let read = await reader.read(); !read.done; read = await reader.read())
		bytes += read.value.byteLength;
	return bytes;
}

/** How long `run` takes, in milliseconds. */
async function timed(run: () => Promise<unknown>): Promise<number> {
	const start = performance.now();
	await run();
	return performance.now() - start;
}

describe("the heavy fills' speed", () => {
	it("streams 16 MB in 8 KB chunks through a TransformStream in under 1 s", async () => {
		const took = await timed(async () => {
			const through = source().pipeThrough(new streams.TransformStream<Uint8Array, Uint8Array>());
			expect(await drain(through)).toBe(TOTAL);
		});
		expect(took).toBeLessThan(1000);
	}, 30_000);

	it("gzips 16 MB in 8 KB chunks and gunzips it back in under 8 s", async () => {
		const scope: Record<string, unknown> = { TransformStream: streams.TransformStream };
		const { CompressionStream, DecompressionStream } = createCompression(scope, {
			// The data, and its gzip header's 10 bytes, which count toward the limit.
			maxDecompressedSize: TOTAL + 10,
		});
		const took = await timed(async () => {
			const round = source()
				.pipeThrough(new CompressionStream("gzip") as TransformStream<Uint8Array, Uint8Array>)
				.pipeThrough(new DecompressionStream("gzip") as TransformStream<Uint8Array, Uint8Array>);
			expect(await drain(round)).toBe(TOTAL);
		});
		expect(took).toBeLessThan(8000);
	}, 60_000);

	it("matches 20,000 URLs against a pattern with groups in under 1 s", async () => {
		const pattern = new URLPattern({ pathname: "/users/:id/posts/:post(\\d+)" });
		const took = await timed(async () => {
			let matched = 0;
			for (let index = 0; index < 20_000; index++)
				if (pattern.test(`https://example.com/users/u${index}/posts/${index}`)) matched++;
			expect(matched).toBe(20_000);
		});
		expect(took).toBeLessThan(1000);
	}, 30_000);
});
