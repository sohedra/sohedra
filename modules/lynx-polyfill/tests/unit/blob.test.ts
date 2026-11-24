// `Blob` and `File`, against the File API, with Node's own (which pass the web platform tests) as
// the reference for bytes and types.

import { Blob as NodeBlob } from "node:buffer";

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { createBlob, fillBlob } from "../../src/fills/web/blob.ts";

const scope: Record<string, unknown> = { TextEncoder, TextDecoder, ReadableStream };
const { Blob, File } = createBlob(scope);

/** A blob's bytes, as an array. */
async function bytesOf(blob: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<number[]> {
	return [...new Uint8Array(await blob.arrayBuffer())];
}

describe("Blob", () => {
	it("joins strings as UTF-8, buffers, views and blobs, as Node's does", async () => {
		const buffer = new Uint8Array([1, 2, 3, 4]);
		const parts = [
			"a€\uD800",
			buffer.buffer,
			buffer.subarray(1, 3),
			new DataView(buffer.buffer, 2),
		];
		const blob = new Blob([...parts, new Blob(["x"])]);
		const node = new NodeBlob([...parts, new NodeBlob(["x"])]);
		expect(blob.size).toBe(node.size);
		expect(await bytesOf(blob)).toEqual(await bytesOf(node));
	});

	it("copies its parts as it is made", async () => {
		const source = new Uint8Array([1, 2]);
		const blob = new Blob([source]);
		source[0] = 9;
		expect(await bytesOf(blob)).toEqual([1, 2]);
	});

	it("has the same bytes as Node's for any list of strings", async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(fc.string({ unit: "binary" })), async (strings) => {
				expect(await bytesOf(new Blob(strings))).toEqual(await bytesOf(new NodeBlob(strings)));
			}),
		);
	});

	it.each([
		["Text/Plain", "text/plain"],
		["a\u00e9", ""],
		["", ""],
	])("takes the type %j as %j", (type, expected) => {
		expect(new Blob([], { type }).type).toBe(expected);
		expect(new NodeBlob([], { type }).type).toBe(expected);
	});

	it("writes line breaks as \\n with endings native, and leaves them with transparent", async () => {
		expect(await new Blob(["a\r\nb\rc\n"], { endings: "native" }).text()).toBe("a\nb\nc\n");
		expect(await new Blob(["a\r\nb"]).text()).toBe("a\r\nb");
		expect(() => new Blob([], { endings: "other" as "native" })).toThrow(TypeError);
	});

	it("refuses parts that are not a list", () => {
		expect(() => new Blob("abc" as unknown as BlobPart[])).toThrow(TypeError);
		expect(new Blob().size).toBe(0);
	});

	it("slices as Node's does, from either end, with a type", async () => {
		const data = "0123456789";
		const cases: [number?, number?][] = [[], [2], [2, 5], [-3], [-3, -1], [5, 2], [-20, 20]];
		for (const [start, end] of cases) {
			const slice = new Blob([data]).slice(start, end, "Text/X");
			const node = new NodeBlob([data]).slice(start, end, "Text/X");
			expect(await slice.text(), `${start}, ${end}`).toBe(await node.text());
			expect(slice.type).toBe("text/x");
			expect(slice).toBeInstanceOf(Blob);
		}
	});

	it("reads as text, bytes, an ArrayBuffer and a stream of chunks", async () => {
		const blob = new Blob(["\uFEFFhé"]);
		expect(await blob.text()).toBe("hé");
		expect(await blob.bytes()).toEqual(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0xc3, 0xa9]));
		const big = new Blob([new Uint8Array(150_000).fill(7)]);
		const chunks: number[] = [];
		for await (const chunk of big.stream() as unknown as AsyncIterable<Uint8Array>)
			chunks.push(chunk.length);
		expect(chunks).toEqual([65_536, 65_536, 18_928]);
	});

	it("is named Blob, and refuses a getter called on something else", () => {
		expect(Blob.name).toBe("Blob");
		expect(Object.prototype.toString.call(new Blob())).toBe("[object Blob]");
		const size = Object.getOwnPropertyDescriptor(Blob.prototype, "size")!.get!;
		expect(() => size.call({})).toThrow(TypeError);
	});
});

describe("File", () => {
	it("has a name, a time and a type, and is a Blob", async () => {
		const file = new File(["abc"], "a.txt", { type: "Text/Plain", lastModified: 42 });
		expect([file.name, file.lastModified, file.type, file.size, file.webkitRelativePath]).toEqual([
			"a.txt",
			42,
			"text/plain",
			3,
			"",
		]);
		expect(file).toBeInstanceOf(Blob);
		expect(await file.text()).toBe("abc");
		expect(Object.prototype.toString.call(file)).toBe("[object File]");
	});

	it("takes the time now when given none", () => {
		const before = Date.now();
		const { lastModified } = new File([], "a");
		expect(lastModified).toBeGreaterThanOrEqual(before);
		expect(lastModified).toBeLessThanOrEqual(Date.now());
	});

	it("refuses to be made without a name", () => {
		expect(() => new (File as unknown as new (parts: BlobPart[]) => File)([])).toThrow(TypeError);
	});
});

describe("the fill", () => {
	it("puts Blob and File on a thread that lacks them, made on first read", () => {
		const target: Record<string, unknown> = { TextEncoder, TextDecoder };
		fillBlob(target);
		expect(Object.getOwnPropertyDescriptor(target, "Blob")?.get).toBeTypeOf("function");
		const Made = target["Blob"] as typeof Blob;
		expect(new (target["File"] as typeof File)([], "a")).toBeInstanceOf(Made);
	});

	it("leaves a thread's own", () => {
		const own = { Blob: NodeBlob, File: class {} };
		const target: Record<string, unknown> = { ...own };
		fillBlob(target);
		expect(target).toEqual(own);
	});
});

describe("the Blob class", () => {
	it("takes no required argument, as Web IDL's: its length is 0", () => {
		expect(Blob.length).toBe(0);
		expect(new Blob().size).toBe(0);
	});
});

describe("slice's offsets", () => {
	it.each([
		[0.5, undefined, "abcd"],
		[1.5, undefined, "cd"],
		[2.5, undefined, "cd"],
		[0, 1.5, "ab"],
		[0, 2.5, "ab"],
		[1.5, 3.5, "cd"],
		[Number.NaN, 2, "ab"],
	])(
		"rounds slice(%s, %s) as Web IDL's [Clamp] does, a tie to the even integer",
		async (start, end, text) => {
			expect(await new Blob(["abcd"]).slice(start, end).text()).toBe(text);
			expect(await new NodeBlob(["abcd"]).slice(start, end).text()).toBe(text);
		},
	);
});

describe("the Blob constructor's reads", () => {
	it("converts the parts first, reading their iterator once, then the options in name order", () => {
		const read: string[] = [];
		const parts = {
			get [Symbol.iterator]() {
				read.push("iterator");
				return function* () {
					yield "a";
				};
			},
		};
		const options = {
			get type() {
				read.push("type");
				return "";
			},
			get endings() {
				read.push("endings");
				return "transparent";
			},
		};
		new Blob(parts as never, options as never);
		expect(read).toEqual(["iterator", "endings", "type"]);
	});
});

describe("a blob's stream", () => {
	it("is a byte stream, which a BYOB reader reads", async () => {
		const reader = new Blob(["abcd"]).stream().getReader({ mode: "byob" });
		const { value } = await reader.read(new Uint8Array(8));
		expect(new TextDecoder().decode(value)).toBe("abcd");
		expect((await reader.read(new Uint8Array(8))).done).toBe(true);
	});
});
