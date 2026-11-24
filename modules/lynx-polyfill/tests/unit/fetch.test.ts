// `fetch`, `Headers`, `Request` and `Response` over lynx-core's `fetch`, against the Fetch Standard,
// with Node's own `Headers` (undici's, which passes the web platform tests) as the reference.
// lynx-core's side is the reduction in lynx-core-fetch.ts: it builds the page global's `Request` and
// `Response` as lynx-core does, so these tests run the fill the way a device does.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import * as vendoredStreams from "../../src/fills/vendor/streams.js";
import { createAbort } from "../../src/fills/web/abort.ts";
import { createBlob } from "../../src/fills/web/blob.ts";
import { createFetch, fillFetch, fillMainThreadFetch } from "../../src/fills/web/fetch.ts";
import { createFormData, decodeMultipart } from "../../src/fills/web/form-data.ts";
import { coreLynx, CoreHeaders, CoreRequest, CoreResponse } from "./lynx-core-fetch.ts";

/**
 * A background's global object as lynx-core leaves it, with the folder's `Blob`, `File`, `FormData`
 * and `AbortController`, and Node's for the rest.
 */
function background(options: { streaming?: boolean; streams?: "node" | "fill" } = {}) {
	const streams =
		options.streams === "fill"
			? vendoredStreams
			: { ReadableStream, WritableStream, TransformStream };
	const scope: Record<string, unknown> = {
		ReadableStream: streams.ReadableStream,
		WritableStream: streams.WritableStream,
		TransformStream: streams.TransformStream,
		structuredClone,
		TextEncoder,
		TextDecoder,
		URL,
		URLSearchParams,
		Event,
		EventTarget,
		DOMException,
		navigator: { userAgent: "Lynx/4.2 (iOS)" },
		Headers: CoreHeaders,
		Request: CoreRequest,
		Response: CoreResponse,
	};
	Object.assign(scope, createAbort(scope), createBlob(scope), { FormData: createFormData(scope) });
	const { lynx, native } = coreLynx(scope, options);
	fillFetch(scope, () => lynx);
	return {
		scope,
		native,
		fetch: scope["fetch"] as typeof fetch,
		Headers: scope["Headers"] as typeof Headers,
		Request: scope["Request"] as typeof Request,
		Response: scope["Response"] as typeof Response,
		AbortController: scope["AbortController"] as typeof AbortController,
		AbortSignal: scope["AbortSignal"] as typeof AbortSignal,
		Blob: scope["Blob"] as typeof Blob,
		File: scope["File"] as typeof File,
		FormData: scope["FormData"] as typeof FormData,
	};
}

/** What a promise settles with: its value, or the name and message of what it rejected with. */
async function settled(promise: Promise<unknown>): Promise<unknown> {
	try {
		return { value: await promise };
	} catch (error) {
		return { error: (error as Error).name, message: (error as Error).message };
	}
}

/** What `run` throws, or `undefined`. */
function thrown(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	return undefined;
}

/** A turn of the event loop, for what lynx-core and the streams do as tasks. */
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

const bytes = (text: string) => new TextEncoder().encode(text).buffer;
const text = (buffer: ArrayBuffer | null) => new TextDecoder().decode(buffer ?? new ArrayBuffer(0));

describe("Headers", () => {
	const { Headers: Fill } = background();

	it("reads a record as Web IDL does: its iterator, its keys once, each descriptor, then each value", () => {
		const log: string[] = [];
		const record = new Proxy(
			{ a: "1", b: "2" },
			{
				get: (target, key, receiver) => {
					log.push(`get ${String(key)}`);
					return Reflect.get(target, key, receiver);
				},
				has: (target, key) => {
					log.push(`has ${String(key)}`);
					return Reflect.has(target, key);
				},
				ownKeys: (target) => {
					log.push("ownKeys");
					return Reflect.ownKeys(target);
				},
				getOwnPropertyDescriptor: (target, key) => {
					log.push(`descriptor ${String(key)}`);
					return Reflect.getOwnPropertyDescriptor(target, key);
				},
			},
		);
		expect(new Fill(record).get("a")).toBe("1");
		expect(log).toEqual([
			"get Symbol(Symbol.iterator)",
			"ownKeys",
			"descriptor a",
			"get a",
			"descriptor b",
			"get b",
		]);
		expect(() => new Fill({ [Symbol("s")]: "x" } as never)).toThrow(TypeError);
		expect(() => new Fill({ "a\uFFFF": "x" })).toThrow(TypeError);
		expect(() => new Fill({ a: "\uFFFF" })).toThrow(TypeError);
	});

	it("iterates as Web IDL's iterators do: seeing changes, under %IteratorPrototype%", () => {
		const headers = new Fill({ "x-header": "1" });
		const keys = headers.keys();
		const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
		expect(Object.getPrototypeOf(Object.getPrototypeOf(keys))).toBe(iteratorPrototype);
		expect(Object.prototype.toString.call(keys)).toBe("[object Headers Iterator]");
		headers.append("set-cookie", "a=b");
		expect([...keys]).toEqual(["set-cookie", "x-header"]);
		expect([...headers]).toEqual([
			["set-cookie", "a=b"],
			["x-header", "1"],
		]);
	});

	it("names headers without regard to case, as lynx-core's does not", () => {
		const headers = new Fill({ "Content-Type": "text/plain" });
		expect(headers.get("content-type")).toBe("text/plain");
		expect(headers.has("CONTENT-TYPE")).toBe(true);
		headers.set("content-TYPE", "application/json");
		expect([...headers]).toEqual([["content-type", "application/json"]]);
		headers.delete("Content-Type");
		expect(headers.has("content-type")).toBe(false);
	});

	it("lists headers sorted and combined, and each set-cookie apart", () => {
		const headers = new Fill([
			["b", "2"],
			["A", "1"],
			["b", "3"],
			["Set-Cookie", "x=1"],
			["set-cookie", "y=2"],
		]);
		expect([...headers]).toEqual([
			["a", "1"],
			["b", "2, 3"],
			["set-cookie", "x=1"],
			["set-cookie", "y=2"],
		]);
		expect(headers.getSetCookie()).toEqual(["x=1", "y=2"]);
		expect(headers.get("set-cookie")).toBe("x=1, y=2");
		expect([...headers.keys()]).toEqual(["a", "b", "set-cookie", "set-cookie"]);
	});

	it("refuses a name or a value HTTP refuses, and trims a value's whitespace", () => {
		expect(thrown(() => new Fill({ "bad name": "x" }))).toBeInstanceOf(TypeError);
		expect(thrown(() => new Fill({ a: "line\nbreak" }))).toBeInstanceOf(TypeError);
		expect(thrown(() => new Fill([["a"]] as unknown as [string, string][]))).toBeInstanceOf(
			TypeError,
		);
		expect(new Fill({ a: " \t padded \t " }).get("a")).toBe("padded");
	});

	it("does what Node's does for any sequence of changes", () => {
		const name = fc.constantFrom("a", "A", "b", "Set-Cookie", "x-Thing");
		const value = fc.constantFrom("1", " 2 ", "three", "");
		const change = fc.oneof(
			fc.tuple(fc.constant("append" as const), name, value),
			fc.tuple(fc.constant("set" as const), name, value),
			fc.tuple(fc.constant("delete" as const), name, value),
		);
		fc.assert(
			fc.property(fc.array(change, { maxLength: 12 }), (changes) => {
				const ours = new Fill();
				const node = new Headers();
				for (const [method, key, entry] of changes) {
					if (method === "delete") {
						ours.delete(key);
						node.delete(key);
					} else {
						ours[method](key, entry);
						node[method](key, entry);
					}
				}
				expect([...ours]).toEqual([...node]);
				expect(ours.get("a")).toBe(node.get("a"));
			}),
		);
	});
});

describe("Request", () => {
	const { Request: Fill, AbortController: Controller, Blob: BlobFill } = background();

	it("normalizes its method, and refuses a forbidden or malformed one", () => {
		expect(new Fill("https://a.example/", { method: "post" }).method).toBe("POST");
		expect(new Fill("https://a.example/", { method: "patch" }).method).toBe("patch");
		expect(thrown(() => new Fill("https://a.example/", { method: "CONNECT" }))).toBeInstanceOf(
			TypeError,
		);
		expect(thrown(() => new Fill("https://a.example/", { method: "a b" }))).toBeInstanceOf(
			TypeError,
		);
	});

	it("parses its URL, and refuses a relative one and one with credentials", () => {
		expect(new Fill("https://a.example/b/../c?d#e").url).toBe("https://a.example/c?d#e");
		expect(thrown(() => new Fill("/relative"))).toBeInstanceOf(TypeError);
		expect(thrown(() => new Fill("https://user:pass@a.example/"))).toBeInstanceOf(TypeError);
	});

	it("refuses a body on GET and HEAD", () => {
		expect(thrown(() => new Fill("https://a.example/", { body: "x" }))).toBeInstanceOf(TypeError);
		expect(
			thrown(() => new Fill("https://a.example/", { method: "HEAD", body: "x" })),
		).toBeInstanceOf(TypeError);
	});

	it.each([
		["a string", () => "text", "text/plain;charset=UTF-8", "text"],
		[
			"URLSearchParams",
			() => new URLSearchParams({ a: "1", b: "c d" }),
			"application/x-www-form-urlencoded;charset=UTF-8",
			"a=1&b=c+d",
		],
		["a typed Blob", () => new BlobFill(["x"], { type: "image/png" }), "image/png", "x"],
		["an ArrayBuffer", () => new TextEncoder().encode("ab").buffer, null, "ab"],
	])("gives %s body the standard's Content-Type", async (_kind, body, type, contents) => {
		const request = new Fill("https://a.example/", { method: "POST", body: body() as BodyInit });
		expect(request.headers.get("content-type")).toBe(type);
		expect(await request.text()).toBe(contents);
	});

	it("takes a stream body only with duplex half", async () => {
		const stream = () =>
			new ReadableStream({ start: (c) => (c.enqueue(new Uint8Array([1])), c.close()) });
		expect(
			thrown(() => new Fill("https://a.example/", { method: "POST", body: stream() })),
		).toBeInstanceOf(TypeError);
		const request = new Fill("https://a.example/", {
			method: "POST",
			body: stream(),
			duplex: "half",
		} as RequestInit);
		expect([...new Uint8Array(await request.arrayBuffer())]).toEqual([1]);
	});

	it("is used once read, and a second read rejects with the standard's TypeError", async () => {
		const request = new Fill("https://a.example/", { method: "POST", body: "once" });
		expect(request.bodyUsed).toBe(false);
		expect(await request.text()).toBe("once");
		expect(request.bodyUsed).toBe(true);
		expect(await settled(request.text())).toMatchObject({ error: "TypeError" });
		expect(thrown(() => request.clone())).toBeInstanceOf(TypeError);
	});

	it("copies another request, and clones with its own body", async () => {
		const first = new Fill("https://a.example/", {
			method: "PUT",
			body: "both",
			headers: { a: "1" },
		});
		const copy = first.clone();
		const second = new Fill(first, { headers: { b: "2" } });
		expect(second.method).toBe("PUT");
		expect([...second.headers]).toEqual([["b", "2"]]);
		expect(await second.text()).toBe("both");
		expect(first.bodyUsed).toBe(true);
		expect(await copy.text()).toBe("both");
	});

	it("has a signal that follows the one it was given", () => {
		const controller = new Controller();
		const request = new Fill("https://a.example/", { signal: controller.signal });
		expect(request.signal.aborted).toBe(false);
		controller.abort();
		expect(request.signal.aborted).toBe(true);
		expect((request.signal.reason as DOMException).name).toBe("AbortError");
		expect(new Fill("https://a.example/").signal.aborted).toBe(false);
	});
});

describe("Response", () => {
	const { Response: Fill, FormData: FormDataFill, File: FileFill } = background();

	it("checks its status and statusText, and has no body where its status allows none", () => {
		expect(thrown(() => new Fill(null, { status: 199 }))).toBeInstanceOf(RangeError);
		expect(thrown(() => new Fill(null, { status: 600 }))).toBeInstanceOf(RangeError);
		expect(thrown(() => new Fill(null, { statusText: "a\nb" }))).toBeInstanceOf(TypeError);
		expect(thrown(() => new Fill("x", { status: 204 }))).toBeInstanceOf(TypeError);
		const response = new Fill(null, { status: 404, statusText: "Not Found" });
		expect([response.ok, response.status, response.statusText, response.body]).toEqual([
			false,
			404,
			"Not Found",
			null,
		]);
		expect([response.type, response.url, response.redirected]).toEqual(["default", "", false]);
	});

	it("makes JSON, error and redirect responses as the statics do", async () => {
		const json = Fill.json({ a: [1] }, { status: 201 });
		expect([json.status, json.headers.get("content-type")]).toEqual([201, "application/json"]);
		expect(await json.json()).toEqual({ a: [1] });
		expect(thrown(() => Fill.json(undefined))).toBeInstanceOf(TypeError);
		const error = Fill.error();
		expect([error.type, error.status, error.body]).toEqual(["error", 0, null]);
		expect(thrown(() => error.headers.set("a", "1"))).toBeInstanceOf(TypeError);
		const redirect = Fill.redirect("https://a.example/next", 307);
		expect([redirect.status, redirect.headers.get("location")]).toEqual([
			307,
			"https://a.example/next",
		]);
		expect(thrown(() => Fill.redirect("https://a.example/", 200))).toBeInstanceOf(RangeError);
	});

	it("reads its body as bytes, text, JSON and a Blob of its type", async () => {
		const make = () => new Fill('{"a":"é"}', { headers: { "Content-Type": "application/json" } });
		expect([...new Uint8Array(await make().arrayBuffer())]).toEqual([
			...new TextEncoder().encode('{"a":"é"}'),
		]);
		expect(await make().bytes()).toEqual(new TextEncoder().encode('{"a":"é"}'));
		expect(await make().text()).toBe('{"a":"é"}');
		expect(await make().json()).toEqual({ a: "é" });
		const blob = await make().blob();
		expect([blob.type, await blob.text()]).toEqual(["application/json", '{"a":"é"}']);
		expect(await new Fill("﻿bom").text()).toBe("bom");
	});

	it("reads a multipart body and a URL-encoded one as FormData", async () => {
		const form = new FormDataFill();
		form.append("name", "value");
		form.append("file", new FileFill(["contents"], "a.txt", { type: "text/plain" }));
		const multipart = new Fill(form);
		const read = await multipart.formData();
		expect(read.get("name")).toBe("value");
		const file = read.get("file") as File;
		expect([file.name, file.type, await file.text()]).toEqual(["a.txt", "text/plain", "contents"]);
		const urlEncoded = await new Fill(new URLSearchParams({ a: "1", b: "two words" })).formData();
		expect([...urlEncoded]).toEqual([
			["a", "1"],
			["b", "two words"],
		]);
		expect(await settled(new Fill("x").formData())).toMatchObject({ error: "TypeError" });
	});

	it("keeps a byte order mark in a URL-encoded body, as the URL-encoded parser does", async () => {
		const read = await new Fill("\uFEFFtest=\uFEFF", {
			headers: { "content-type": "application/x-www-form-urlencoded" },
		}).formData();
		expect([...read]).toEqual([["\uFEFFtest", "\uFEFF"]]);
	});

	it("reads a body whole before formData() checks its type, so a stream's error comes first", async () => {
		const failure = new Error("pull error");
		const body = new ReadableStream({
			pull() {
				throw failure;
			},
		});
		await expect(new Fill(body).formData()).rejects.toBe(failure);
	});

	it("reads its body as bytes, with a BYOB reader too", async () => {
		const reader = new Fill("abcd").body!.getReader({ mode: "byob" });
		const { value } = await reader.read(new Uint8Array(8));
		expect(new TextDecoder().decode(value)).toBe("abcd");
		expect((await reader.read(new Uint8Array(8))).done).toBe(true);
	});

	it("gives Response.json() JSON's type unless the init's headers name one", () => {
		expect(Fill.json({}, { headers: {} }).headers.get("content-type")).toBe("application/json");
		expect(
			Fill.json({}, { headers: { "content-type": "foo/bar" } }).headers.get("content-type"),
		).toBe("foo/bar");
	});

	it("gives its body as a stream, which uses it", async () => {
		const response = new Fill("streamed");
		const body = response.body!;
		expect(response.body).toBe(body);
		expect(response.bodyUsed).toBe(false);
		const reader = body.getReader();
		const parts: number[] = [];
		for (let read = await reader.read(); !read.done; read = await reader.read())
			parts.push(...read.value);
		expect(text(new Uint8Array(parts).buffer)).toBe("streamed");
		expect(response.bodyUsed).toBe(true);
		expect(await settled(response.text())).toMatchObject({ error: "TypeError" });
	});

	it("refuses to read a body whose stream another reader holds", async () => {
		const response = new Fill("held");
		response.body!.getReader();
		expect(await settled(response.text())).toMatchObject({ error: "TypeError" });
	});

	it("clones, and each copy reads the whole body", async () => {
		const response = new Fill("twice", { status: 201, headers: { a: "1" } });
		const copy = response.clone();
		expect([copy.status, copy.headers.get("a")]).toEqual([201, "1"]);
		expect(await response.text()).toBe("twice");
		expect(await copy.text()).toBe("twice");
		const streamed = new Fill("tee");
		void streamed.body;
		const branch = streamed.clone();
		expect([await streamed.text(), await branch.text()]).toEqual(["tee", "tee"]);
	});
});

describe("Response's body, as Fetch reads and tees it", () => {
	it("is empty for an empty FormData, which reads back as an empty form", async () => {
		const { Response: Fill, FormData: FormDataFill } = background();
		expect(await new Fill(new FormDataFill()).text()).toBe("");
		expect([...(await new Fill(new FormDataFill()).formData())]).toEqual([]);
	});

	it("copies each chunk for a clone, as Fetch's tee does with StructuredClone", async () => {
		const { Response: Fill } = background();
		const chunks = [
			new ArrayBuffer(4),
			new Uint8Array([1, 2, 3]),
			new Int16Array([1, -1]),
			new DataView(new ArrayBuffer(8), 2, 4),
		];
		for (const chunk of chunks) {
			const response = new Fill(
				new ReadableStream({
					start(controller) {
						controller.enqueue(chunk);
						controller.close();
					},
				}),
			);
			const clone = response.clone();
			const original = (await response.body!.getReader().read()).value as unknown;
			const copied = (await clone.body!.getReader().read()).value as ArrayBufferView;
			expect(original).toBe(chunk);
			expect(copied).not.toBe(chunk);
			expect(Object.getPrototypeOf(copied)).toBe(Object.getPrototypeOf(chunk));
			if (ArrayBuffer.isView(chunk))
				expect([copied.byteOffset, copied.byteLength]).toEqual([
					chunk.byteOffset,
					chunk.byteLength,
				]);
		}
	});

	it("gives the stream it was made from as its body", () => {
		const { Response: Fill } = background();
		const stream = new ReadableStream();
		expect(new Fill(stream).body).toBe(stream);
	});

	it("is used once someone else reads, cancels or pipes its stream", async () => {
		const { Response: Fill, scope } = background({ streams: "fill" });
		const Stream = scope["ReadableStream"] as typeof ReadableStream;
		const Writable = scope["WritableStream"] as typeof WritableStream;
		const read = new Fill(new Stream());
		const reader = read.body!.getReader();
		expect(read.bodyUsed).toBe(false);
		void reader.read();
		expect(read.bodyUsed).toBe(true);
		const cancelled = new Fill(new Stream());
		void cancelled.body!.getReader().cancel();
		expect(cancelled.bodyUsed).toBe(true);
		const piped = new Fill(new Stream());
		void piped.body!.pipeTo(new Writable({}, { highWaterMark: 0 }));
		expect(piped.bodyUsed).toBe(true);
		const consumed = new Fill("text");
		void consumed.text();
		expect(thrown(() => consumed.body!.getReader())).toBeInstanceOf(TypeError);
	});

	it("can't be made from a stream someone has read", async () => {
		const { Response: Fill, scope } = background({ streams: "fill" });
		const Stream = scope["ReadableStream"] as typeof ReadableStream;
		const stream = new Stream({ pull: (controller) => controller.enqueue(new Uint8Array()) });
		const reader = stream.getReader();
		await reader.read();
		reader.releaseLock();
		expect(thrown(() => new Fill(stream))).toBeInstanceOf(TypeError);
	});

	it("is read whole without a page's Object.prototype.then stepping in", async () => {
		const { Response: Fill, scope } = background({ streams: "fill" });
		const Stream = scope["ReadableStream"] as typeof ReadableStream;
		const Writable = scope["WritableStream"] as typeof WritableStream;
		const hello = new TextEncoder().encode("hello");
		const inject = (value: unknown) => {
			// oxlint-disable-next-line unicorn/no-thenable -- a page's polluted then is what this checks
			Object.defineProperty(Object.prototype, "then", {
				configurable: true,
				writable: true,
				value(onFulfilled: (value: unknown) => void) {
					delete (Object.prototype as { then?: unknown }).then;
					onFulfilled(value);
				},
			});
		};
		try {
			for (const value of [
				{ done: false, value: new TextEncoder().encode("bye") },
				undefined,
				8.2,
			]) {
				const streamed = new Fill(
					new Stream({
						start(controller) {
							controller.enqueue(hello);
							controller.close();
						},
					}),
				);
				inject(value);
				expect(await streamed.text()).toBe("hello");
				const given = new Fill(hello);
				inject(value);
				expect(await given.text()).toBe("hello");
			}
			const written: number[] = [];
			const piped = new Fill(new Uint8Array([1, 2, 3]));
			inject({ done: false, value: new Uint8Array([4, 5, 6]) });
			await piped.body!.pipeTo(
				new Writable({
					write(chunk: Uint8Array) {
						written.push(...chunk);
					},
				}),
			);
			expect(written).toEqual([1, 2, 3]);
		} finally {
			delete (Object.prototype as { then?: unknown }).then;
		}
	});
});

describe("fetch", () => {
	it("hands lynx-core the request: its method, URL, headers and body", async () => {
		const { fetch: fill, native } = background();
		void fill("https://a.example/post", {
			method: "POST",
			headers: { "X-Thing": "1" },
			body: JSON.stringify({ a: 1 }),
		});
		await turn();
		const [request] = native.requests;
		expect([request!.method, request!.url]).toEqual(["POST", "https://a.example/post"]);
		expect(request!.headers).toMatchObject({
			"x-thing": "1",
			"content-type": "text/plain;charset=UTF-8",
		});
		expect(text(request!.body)).toBe('{"a":1}');
	});

	it("sends a header named as an object's own property, constructor or __proto__", async () => {
		const { fetch: fill, native } = background();
		void fill("https://a.example/", {
			headers: [
				["constructor", "a"],
				["__proto__", "b"],
			],
		});
		await turn();
		const sent = native.requests[0]!.headers;
		expect([
			sent["constructor"],
			Object.getOwnPropertyDescriptor(sent, "__proto__")?.value,
		]).toEqual(["a", "b"]);
	});

	it("sends no User-Agent of its own, so the native module's stands, and the request's as given", async () => {
		const { fetch: fill, native } = background();
		void fill("https://a.example/");
		void fill("https://a.example/", { headers: { "User-Agent": "mine/1" } });
		await turn();
		expect(native.requests.map((request) => request.headers["user-agent"])).toEqual([
			undefined,
			"mine/1",
		]);
	});

	it("sends a Blob's bytes, and FormData as multipart with its boundary", async () => {
		const {
			fetch: fill,
			native,
			scope,
			Blob: BlobFill,
			File: FileFill,
			FormData: FormDataFill,
		} = background();
		void fill("https://a.example/", {
			method: "POST",
			body: new BlobFill(["blob"], { type: "text/x" }),
		});
		const form = new FormDataFill();
		form.append("field", "value");
		form.append("file", new FileFill(["data"], "f.bin"));
		void fill("https://a.example/", { method: "POST", body: form });
		await turn();
		await turn();
		const [blob, multipart] = native.requests;
		expect([text(blob!.body), blob!.headers["content-type"]]).toEqual(["blob", "text/x"]);
		const type = multipart!.headers["content-type"]!;
		expect(type).toMatch(/^multipart\/form-data; boundary=/);
		const read = decodeMultipart(scope, new Uint8Array(multipart!.body!), type);
		expect(read.get("field")).toBe("value");
		expect(await (read.get("file") as File).text()).toBe("data");
	});

	it("answers with the fill's Response: status, case-insensitive immutable headers, URL and body", async () => {
		const { fetch: fill, native, Response: Fill } = background();
		const answer = fill("https://a.example/");
		await turn();
		native.respond({
			status: 201,
			statusText: "Created",
			url: "https://a.example/",
			headers: { "Content-Type": "text/plain" },
		});
		const response = await answer;
		expect(response).toBeInstanceOf(Fill);
		expect([response.status, response.statusText, response.ok, response.url]).toEqual([
			201,
			"Created",
			true,
			"https://a.example/",
		]);
		expect(response.headers.get("content-type")).toBe("text/plain");
		expect(thrown(() => response.headers.set("a", "1"))).toBeInstanceOf(TypeError);
		native.stream().onData(bytes("he"));
		native.stream().onData(bytes("llo"));
		native.stream().onEnd();
		expect(await response.text()).toBe("hello");
	});

	it("streams the body as it arrives, chunk by chunk", async () => {
		const { fetch: fill, native } = background();
		const answer = fill("https://a.example/");
		await turn();
		native.respond({ status: 200 });
		const reader = (await answer).body!.getReader();
		native.stream().onData(bytes("first"));
		expect(text((await reader.read()).value!.buffer as ArrayBuffer)).toBe("first");
		native.stream().onData(bytes("second"));
		expect(text((await reader.read()).value!.buffer as ArrayBuffer)).toBe("second");
		native.stream().onEnd();
		expect((await reader.read()).done).toBe(true);
	});

	it("reads a body lynx-core does not stream, when the page turns streaming off", async () => {
		const { fetch: fill, native } = background({ streaming: false });
		const answer = fill("https://a.example/");
		await turn();
		native.respond({ status: 200, body: bytes("whole") });
		expect(await (await answer).text()).toBe("whole");
	});

	it("rejects with a TypeError when the request fails, and when the stream breaks", async () => {
		const { fetch: fill, native } = background();
		const failed = fill("https://a.example/");
		await turn();
		native.fail("offline");
		expect(await settled(failed)).toEqual({ error: "TypeError", message: "offline" });
		const broken = fill("https://a.example/");
		await turn();
		native.respond({ status: 200 });
		const response = await broken;
		native.stream().onError("reset");
		expect(await settled(response.text())).toMatchObject({ error: "TypeError" });
	});

	it("rejects with the signal's reason, aborted before it starts or before the answer", async () => {
		const { fetch: fill, AbortController: Controller, AbortSignal: Signal } = background();
		expect(await settled(fill("https://a.example/", { signal: Signal.abort() }))).toMatchObject({
			error: "AbortError",
		});
		const controller = new Controller();
		const answer = fill("https://a.example/", { signal: controller.signal });
		await turn();
		controller.abort();
		expect(await settled(answer)).toMatchObject({ error: "AbortError" });
	});

	it("cancels the stream when aborted after the headers, and its reads reject with an AbortError", async () => {
		const { fetch: fill, native, AbortController: Controller } = background();
		const controller = new Controller();
		const answer = fill("https://a.example/", { signal: controller.signal });
		await turn();
		native.respond({ status: 200 });
		const response = await answer;
		native.stream().onData(bytes("part"));
		controller.abort();
		expect(await settled(response.text())).toMatchObject({ error: "AbortError" });
		expect(native.stream().cancelled).toBe(true);
	});

	it("leaves new Response() as the standard's while a request waits", async () => {
		const { fetch: fill, Response: Fill } = background();
		void fill("https://a.example/");
		await turn();
		const response = new Fill("own", { status: 202 });
		expect([response.status, await response.text()]).toEqual([202, "own"]);
	});
});

describe("Request's other options", () => {
	const { Request: Fill } = background();

	it("keeps the options a browser's fetch reads, with the standard's defaults, and refuses a value it lacks", () => {
		const plain = new Fill("https://a.example/");
		expect([plain.mode, plain.credentials, plain.cache, plain.redirect]).toEqual([
			"cors",
			"same-origin",
			"default",
			"follow",
		]);
		expect([plain.referrer, plain.referrerPolicy, plain.integrity, plain.keepalive]).toEqual([
			"about:client",
			"",
			"",
			false,
		]);
		expect([plain.destination, (plain as Request & { duplex: string }).duplex]).toEqual([
			"",
			"half",
		]);
		const given = new Fill("https://a.example/", {
			mode: "no-cors",
			credentials: "include",
			cache: "no-store",
			redirect: "manual",
			referrer: "",
			integrity: "sha256-x",
			keepalive: true,
		});
		expect([
			given.mode,
			given.credentials,
			given.cache,
			given.redirect,
			given.referrer,
			given.integrity,
			given.keepalive,
		]).toEqual(["no-cors", "include", "no-store", "manual", "", "sha256-x", true]);
		expect(
			thrown(() => new Fill("https://a.example/", { cache: "sometimes" as RequestCache })),
		).toBeInstanceOf(TypeError);
		expect(thrown(() => new Fill("https://a.example/", { mode: "navigate" }))).toBeInstanceOf(
			TypeError,
		);
	});

	it("refuses to read a request's or a response's fields from another object", () => {
		const { Response: ResponseFill } = background();
		const url = Object.getOwnPropertyDescriptor(Fill.prototype, "url")!.get!;
		const status = Object.getOwnPropertyDescriptor(ResponseFill.prototype, "status")!.get!;
		expect(thrown(() => url.call({}))).toBeInstanceOf(TypeError);
		expect(thrown(() => status.call({}))).toBeInstanceOf(TypeError);
	});

	it("takes a URL as given, and gives no signal, on a thread without URL or AbortController", () => {
		const { Request: Bare } = createFetch({ TextEncoder, TextDecoder }, () => ({
			reportError() {},
		}));
		const request = new Bare("relative/path");
		expect([request.url, request.signal]).toEqual(["relative/path", null]);
	});
});

describe("fetch when lynx-core answers in its own classes", () => {
	it("reads the body of lynx-core's own Response into the fill's", async () => {
		// lynx-core's page global is another object than the one the fill went on.
		const pageGlobal: Record<string, unknown> = { Request: CoreRequest, Response: CoreResponse };
		const { lynx, native } = coreLynx(pageGlobal, { streaming: false });
		const scope: Record<string, unknown> = { ReadableStream, TextEncoder, TextDecoder, URL };
		fillFetch(scope, () => lynx);
		const answer = (scope["fetch"] as typeof fetch)("https://a.example/");
		await turn();
		native.respond({
			status: 202,
			statusText: "Accepted",
			headers: { "X-A": "1" },
			body: bytes("core"),
		});
		const response = await answer;
		expect(response).toBeInstanceOf(scope["Response"] as typeof Response);
		expect([response.status, response.statusText, response.headers.get("x-a")]).toEqual([
			202,
			"Accepted",
			"1",
		]);
		expect(await response.text()).toBe("core");
	});

	it("rejects with a TypeError for a status the Response can't have, as lynx-core does", async () => {
		const { fetch: fill, native } = background();
		const answer = fill("https://a.example/");
		await turn();
		native.respond({ status: 101, statusText: "Switching" });
		expect(await settled(answer)).toEqual({ error: "TypeError", message: "Switching" });
	});

	it("rejects when the thread has no lynx fetch, or it throws", async () => {
		const scope: Record<string, unknown> = { TextEncoder, TextDecoder, URL };
		fillFetch(scope, () => ({ reportError() {} }));
		expect(await settled((scope["fetch"] as typeof fetch)("https://a.example/"))).toMatchObject({
			error: "TypeError",
		});
		const failing: Record<string, unknown> = { TextEncoder, TextDecoder, URL };
		const broken = new Error("native module missing");
		fillFetch(failing, () => ({
			reportError() {},
			fetch: () => {
				throw broken;
			},
		}));
		expect(await settled((failing["fetch"] as typeof fetch)("https://a.example/"))).toMatchObject({
			message: "native module missing",
		});
	});

	it("rejects with the reason of an abort that comes while the request's body is read", async () => {
		const { fetch: fill, native, AbortController: Controller } = background();
		const controller = new Controller();
		const answer = fill("https://a.example/", {
			method: "POST",
			body: "x",
			signal: controller.signal,
		});
		controller.abort();
		expect(await settled(answer)).toMatchObject({ error: "AbortError" });
		expect(native.requests).toEqual([]);
	});
});

describe("the fill", () => {
	it("replaces lynx-core's family, whose Headers mind case", () => {
		const { scope } = background();
		expect(scope["Headers"]).not.toBe(CoreHeaders);
		expect(scope["Request"]).not.toBe(CoreRequest);
		expect(scope["Response"]).not.toBe(CoreResponse);
		expect(Object.getOwnPropertyDescriptor(scope, "fetch")).toMatchObject({
			enumerable: false,
			writable: true,
			configurable: true,
		});
	});

	it("leaves a family that follows the standard", () => {
		const own = { fetch, Headers, Request, Response };
		const scope: Record<string, unknown> = { ...own };
		fillFetch(scope, () => ({ reportError() {} }));
		expect(scope).toEqual(own);
	});

	it("makes the classes the background puts, from the scope", () => {
		const scope: Record<string, unknown> = { TextEncoder, TextDecoder, ReadableStream, URL };
		const made = createFetch(scope, () => ({ reportError() {} }));
		expect(Object.keys(made).sort()).toEqual(["Headers", "Request", "Response", "fetch"]);
	});
});

describe("on the main thread", () => {
	it("has Headers, Request and Response, and a fetch that says it runs on the background", async () => {
		const scope: Record<string, unknown> = { TextEncoder, TextDecoder, URL };
		fillMainThreadFetch(scope);
		const Fill = scope["Response"] as typeof Response;
		expect(await new Fill("first frame").text()).toBe("first frame");
		expect(new (scope["Headers"] as typeof Headers)({ A: "1" }).get("a")).toBe("1");
		expect(new (scope["Request"] as typeof Request)("https://a.example/").method).toBe("GET");
		const error = thrown(() => (scope["fetch"] as typeof fetch)("https://a.example/")) as Error & {
			code: string;
		};
		expect(error.code).toBe("fetch_on_main_thread");
		expect(error.message.split("\n")[0]).toBe(
			"fetch was called on the main thread, where it does not run.",
		);
	});
});
