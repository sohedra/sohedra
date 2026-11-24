// The streams family, by web-streams-polyfill, and the check that replaces lynx-core's
// `ReadableStream`: a receiver for `fetch`'s chunks that an app can't use.

import {
	ReadableStream as NodeReadableStream,
	TransformStream as NodeTransformStream,
} from "node:stream/web";

import { describe, expect, it } from "@rstest/core";

import * as vendored from "../../../src/polyfill/vendor/streams.js";
import { fillStreams } from "../../../src/polyfill/web/streams.ts";

const FAMILY = Object.keys(vendored).sort();

/** lynx-core's `ReadableStream` (modules/fetch/ReadableStream.ts): takes no source, no pipes. */
class LynxCoreReadableStream {
	onData(): void {}
	onEnd(): void {}
	getReader(): object {
		return { read: async () => ({ done: true, value: undefined }) };
	}
}

describe("the fill", () => {
	it("puts the whole family on a thread that lacks it, each made on first read", () => {
		const scope: Record<string, unknown> = {};
		fillStreams(scope);
		expect(Object.getOwnPropertyNames(scope).sort()).toEqual(FAMILY);
		expect(FAMILY).toContain("ReadableStreamBYOBReader");
		expect(FAMILY).toContain("CountQueuingStrategy");
		for (const name of FAMILY)
			expect(Object.getOwnPropertyDescriptor(scope, name)?.get, name).toBeTypeOf("function");
		expect(scope["ReadableStream"]).toBe(vendored.ReadableStream);
	});

	it("replaces lynx-core's ReadableStream, and the rest with it", () => {
		const scope: Record<string, unknown> = { ReadableStream: LynxCoreReadableStream };
		fillStreams(scope);
		expect(scope["ReadableStream"]).toBe(vendored.ReadableStream);
		expect(scope["TransformStream"]).toBe(vendored.TransformStream);
	});

	it("leaves a thread's own family that works", () => {
		const own = { ReadableStream: NodeReadableStream, TransformStream: NodeTransformStream };
		const scope: Record<string, unknown> = { ...own };
		fillStreams(scope);
		expect(scope).toEqual(own);
	});
});

describe("the streams it puts", () => {
	it("read what their source gives, pipe through a transform, tee, and iterate", async () => {
		const scope: Record<string, unknown> = {};
		fillStreams(scope);
		const ReadableStream = scope["ReadableStream"] as typeof globalThis.ReadableStream;
		const TransformStream = scope["TransformStream"] as typeof globalThis.TransformStream;
		const source = new ReadableStream<number>({
			start(controller) {
				controller.enqueue(1);
				controller.enqueue(2);
				controller.close();
			},
		}).pipeThrough(
			new TransformStream<number, number>({
				transform(chunk, controller) {
					controller.enqueue(chunk * 10);
				},
			}),
		);
		const [left, right] = source.tee();
		const read: number[] = [];
		for await (const chunk of left as unknown as AsyncIterable<number>) read.push(chunk);
		const reader = right.getReader();
		expect(read).toEqual([10, 20]);
		expect(await reader.read()).toEqual({ done: false, value: 10 });
	});

	it("make a stream from an iterable", async () => {
		const scope: Record<string, unknown> = {};
		fillStreams(scope);
		const ReadableStream = scope["ReadableStream"] as typeof NodeReadableStream;
		const read: string[] = [];
		for await (const chunk of ReadableStream.from(["a", "b"])) read.push(chunk);
		expect(read).toEqual(["a", "b"]);
	});
});
