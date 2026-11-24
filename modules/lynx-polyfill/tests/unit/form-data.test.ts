// `FormData`, against the XMLHttpRequest Standard, and its multipart/form-data bodies, with Node's
// own `Response` (undici, which passes the web platform tests) as the reference for both ways.

import { File as NodeFile } from "node:buffer";

import { describe, expect, it } from "@rstest/core";

import { createBlob } from "../../src/fills/web/blob.ts";
import {
	createFormData,
	decodeMultipart,
	encodeMultipart,
	fillFormData,
	MULTIPART_LIMITS,
	multipartBoundary,
} from "../../src/fills/web/form-data.ts";

const scope: Record<string, unknown> = { TextEncoder, TextDecoder, ReadableStream };
Object.assign(scope, createBlob(scope));
scope["FormData"] = createFormData(scope);
const Blob = scope["Blob"] as typeof globalThis.Blob;
const File = scope["File"] as typeof globalThis.File;
const FormData = scope["FormData"] as typeof globalThis.FormData;

/** Node's own `FormData` (the test page's global is the DOM's). */
const NodeFormData = (
	await new Response("", {
		headers: { "content-type": "application/x-www-form-urlencoded" },
	}).formData()
).constructor as typeof globalThis.FormData;

/** `form`'s multipart/form-data body, and its `Content-Type`. */
async function encode(
	form: globalThis.FormData,
): Promise<{ bytes: Uint8Array; contentType: string }> {
	const boundary = multipartBoundary();
	return {
		bytes: (await encodeMultipart(form, boundary)).bytes,
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

/** What a form holds, its files as their names, types and text. */
async function contentsOf(form: Iterable<[string, FormDataEntryValue]>): Promise<unknown[]> {
	const contents: unknown[] = [];
	for (const [name, value] of form)
		contents.push([
			name,
			typeof value === "string" ? value : [value.name, value.type, await value.text()],
		]);
	return contents;
}

describe("FormData", () => {
	it("appends, sets, gets and deletes entries in order", () => {
		const form = new FormData();
		form.append("a", "1");
		form.append("b", "2");
		form.append("a", "3");
		expect([form.get("a"), form.getAll("a"), form.has("b"), form.get("c")]).toEqual([
			"1",
			["1", "3"],
			true,
			null,
		]);
		form.set("a", "4");
		expect([...form]).toEqual([
			["a", "4"],
			["b", "2"],
		]);
		form.set("c", "5");
		form.delete("b");
		expect([...form.keys()]).toEqual(["a", "c"]);
		expect([...form.values()]).toEqual(["4", "5"]);
		const seen: unknown[] = [];
		form.forEach(function (this: unknown, value, name, parent) {
			seen.push([name, value, parent === form, this]);
		}, "that");
		expect(seen).toEqual([
			["a", "4", true, "that"],
			["c", "5", true, "that"],
		]);
	});

	it("makes names and values text, each lone surrogate U+FFFD", () => {
		const form = new FormData();
		form.append("x\uD800", 12 as unknown as string);
		expect([...form]).toEqual([["x�", "12"]]);
	});

	it("makes a Blob a File named blob, and renames a File given a name", () => {
		const form = new FormData();
		form.append("a", new Blob(["x"], { type: "text/plain" }));
		const original = new File(["y"], "y.txt", { lastModified: 5 });
		form.append("b", original);
		form.append("c", original, "z.txt");
		const [a, b, c] = form.getAll("a").concat(form.getAll("b"), form.getAll("c")) as File[];
		expect(a).toBeInstanceOf(File);
		expect([a!.name, a!.type]).toEqual(["blob", "text/plain"]);
		expect(b).toBe(original);
		expect([c!.name, c!.lastModified]).toEqual(["z.txt", 5]);
	});

	it("refuses too few arguments, a file name with text, and a form element", () => {
		const form = new FormData();
		expect(() => (form.append as (name: string) => void)("a")).toThrow(TypeError);
		expect(() => (form.set as (...args: string[]) => void)("a", "b", "c")).toThrow(TypeError);
		expect(() => new FormData({} as HTMLFormElement)).toThrow(TypeError);
	});

	it("iterates live, as WebIDL's iterators do", () => {
		const form = new FormData();
		form.append("a", "1");
		const names: string[] = [];
		for (const [name] of form) {
			names.push(name);
			if (name === "a") form.append("b", "2");
		}
		expect(names).toEqual(["a", "b"]);
	});

	it("is named FormData", () => {
		expect(FormData.name).toBe("FormData");
		expect(Object.prototype.toString.call(new FormData())).toBe("[object FormData]");
		expect(() => FormData.prototype.get.call({}, "a")).toThrow(TypeError);
	});
});

describe("encodeMultipart", () => {
	it("writes text that Node's Response reads back as the same entries", async () => {
		// Node's reader can't make a File in the test page's DOM realm, so files are checked below.
		const form = new FormData();
		form.append("text", "line\none\r\ntwo\rthree é");
		form.append('na"me\n', "v");
		const { bytes, contentType } = await encode(form);
		expect(contentType).toMatch(/^multipart\/form-data; boundary=----formdata-sohedra-\d{16}$/);
		expect(multipartBoundary()).not.toBe(multipartBoundary());
		const read = await new Response(bytes as Uint8Array<ArrayBuffer>, {
			headers: { "content-type": contentType },
		}).formData();
		expect(await contentsOf(read)).toEqual([
			["text", "line\r\none\r\ntwo\r\nthree é"],
			['na"me\r\n', "v"],
		]);
	});

	it("writes a file part with its escaped name and its type, application/octet-stream when none", async () => {
		const form = new FormData();
		form.append("file", new File(["bytes"], 'f"\r.txt', { type: "image/png" }));
		form.append("untyped", new File(["x"], "x.bin"));
		const { bytes, contentType } = await encode(form);
		const read = decodeMultipart(scope, bytes, contentType);
		expect(await contentsOf(read)).toEqual([
			["file", ['f"\r.txt', "image/png", "bytes"]],
			["untyped", ["x.bin", "application/octet-stream", "x"]],
		]);
	});

	it("writes the same bytes as Node's, but for the boundary", async () => {
		const form = new FormData();
		const node = new NodeFormData();
		for (const each of [form, node]) {
			each.append("a\nb", "c\nd");
			each.append("f", new (each === form ? File : (NodeFile as typeof File))(["z"], 'q"\n', {}));
		}
		const ours = await encode(form);
		const theirs = new Response(node);
		const boundary = (contentType: string) => contentType.split("boundary=")[1]!;
		const text = new TextDecoder().decode(ours.bytes).replaceAll(boundary(ours.contentType), "B");
		const nodeText = (await theirs.text()).replaceAll(
			boundary(theirs.headers.get("content-type")!),
			"B",
		);
		expect(text).toBe(nodeText);
	});
});

describe("decodeMultipart", () => {
	/** The bytes and type of a body Node writes for `form`. */
	async function nodeBody(form: globalThis.FormData) {
		const response = new Response(form);
		return {
			bytes: new Uint8Array(await response.arrayBuffer()),
			contentType: response.headers.get("content-type")!,
		};
	}

	it("reads what Node's Response writes", async () => {
		const node = new NodeFormData();
		node.append("a", "1\r\n2 é");
		node.append("a", "");
		node.append("file", new NodeFile(["\x00\xff"], "f.bin", { type: "application/x-y" }) as Blob);
		const { bytes, contentType } = await nodeBody(node);
		const form = decodeMultipart(scope, bytes, contentType);
		expect(form).toBeInstanceOf(FormData);
		expect(await contentsOf(form)).toEqual([
			["a", "1\r\n2 é"],
			["a", ""],
			["file", ["f.bin", "application/x-y", "\x00\xff"]],
		]);
		const file = form.get("file") as File;
		expect(file).toBeInstanceOf(File);
		expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([0, 0xc3, 0xbf]);
	});

	it("reads a quoted boundary, preamble, padding and a file without a type", async () => {
		const body =
			'preamble\r\n--b b \t\r\nContent-Disposition: form-data; name="f"; filename="x"\r\n\r\nzz\r\n--b b--\r\nepilogue';
		const form = decodeMultipart(
			scope,
			new TextEncoder().encode(body),
			'multipart/form-data; boundary="b b"',
		);
		const file = form.get("f") as File;
		expect([file.name, file.type, await file.text()]).toEqual(["x", "text/plain", "zz"]);
	});

	it.each([
		["text/plain", "a"],
		["multipart/form-data", "a"],
		["multipart/form-data; boundary=b", "no boundary line"],
		["multipart/form-data; boundary=b", "--b\r\nContent-Disposition: form-data\r\n\r\nx\r\n--b--"],
		[
			"multipart/form-data; boundary=b",
			'--b\r\nContent-Disposition: form-data; name="a"\r\n\r\nnever ends',
		],
		["multipart/form-data; boundary=b", '--b\r\nContent-Disposition: form-data; name="a"'],
		["multipart/form-data; boundary=b", "--b\r\nno colon\r\n\r\nx\r\n--b--"],
		[
			"multipart/form-data; boundary=b",
			'--b\r\nContent-Disposition: inline; name="a"\r\n\r\nx\r\n--b--',
		],
		["multipart/form-data; boundary=b", "--bx"],
	])("refuses a body of type %j that reads %j", (contentType, body) => {
		expect(() => decodeMultipart(scope, new TextEncoder().encode(body), contentType)).toThrow(
			TypeError,
		);
	});

	it("refuses a body with more parts than its limit", () => {
		const part = '--b\r\nContent-Disposition: form-data; name="a"\r\n\r\nx\r\n';
		const body = (count: number) => new TextEncoder().encode(`${part.repeat(count)}--b--\r\n`);
		const type = "multipart/form-data; boundary=b";
		expect([...decodeMultipart(scope, body(3), type, { parts: 3 }).keys()]).toHaveLength(3);
		expect(() => decodeMultipart(scope, body(4), type, { parts: 3 })).toThrow(
			"The multipart/form-data body has more than 3 parts, the most it may have.",
		);
		expect(MULTIPART_LIMITS.parts).toBe(1000);
		expect(() => decodeMultipart(scope, body(1001), type)).toThrow(TypeError);
	});

	it("refuses a part with more bytes of headers than its limit", () => {
		const type = "multipart/form-data; boundary=b";
		const body = (padding: number) =>
			new TextEncoder().encode(
				`--b\r\nContent-Disposition: form-data; name="a"\r\nX: ${"y".repeat(padding)}\r\n\r\nx\r\n--b--\r\n`,
			);
		const headers = 'Content-Disposition: form-data; name="a"\r\nX: '.length;
		expect(decodeMultipart(scope, body(100 - headers), type, { headerBytes: 100 }).get("a")).toBe(
			"x",
		);
		expect(() => decodeMultipart(scope, body(101 - headers), type, { headerBytes: 100 })).toThrow(
			"A part of the multipart/form-data body has more than 100 bytes of headers, the most it may have.",
		);
		expect(MULTIPART_LIMITS.headerBytes).toBe(16_384);
	});

	it("gives back what encodeMultipart wrote", async () => {
		const form = new FormData();
		form.append("a", "x\r\ny");
		form.append("f", new File([new Uint8Array([0, 13, 10, 45, 45])], "f", { type: "a/b" }));
		const { bytes, contentType } = await encode(form);
		const read = decodeMultipart(scope, bytes, contentType);
		expect(await contentsOf(read)).toEqual(await contentsOf(form));
	});
});

describe("the fill", () => {
	it("puts FormData on a thread that lacks it, made on first read", () => {
		const target: Record<string, unknown> = {};
		fillFormData(target);
		expect(Object.getOwnPropertyDescriptor(target, "FormData")?.get).toBeTypeOf("function");
		expect((target["FormData"] as typeof FormData).name).toBe("FormData");
	});

	it("leaves a thread's own", () => {
		const target: Record<string, unknown> = { FormData: NodeFormData };
		fillFormData(target);
		expect(target["FormData"]).toBe(NodeFormData);
	});
});
