// `URL` and `URLSearchParams`, by whatwg-url-minimum, with Node's own (which passes the web platform
// tests) as the reference; and the check that replaces lynx-core's `URL`, which gets most of a URL
// wrong.

import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from "node:url";

import { describe, expect, it } from "@rstest/core";

import { fillUrl } from "../../src/fills/web/url.ts";

/** A thread without `URL`, filled. */
function filled() {
	const scope: Record<string, unknown> = {};
	fillUrl(scope);
	return {
		scope,
		URL: scope["URL"] as typeof URL,
		URLSearchParams: scope["URLSearchParams"] as typeof URLSearchParams,
	};
}

const FIELDS = [
	"href",
	"origin",
	"protocol",
	"username",
	"password",
	"host",
	"hostname",
	"port",
	"pathname",
	"search",
	"hash",
] as const;

const CASES: [string, string?][] = [
	["https://user:pass@example.com:8080/a/b?c=d#e"],
	["HTTPS://EXAMPLE.com/%7Efoo/./bar/../baz"],
	["../x?q=1#h", "https://a.example:8080/b/c/d"],
	["//other.example/p", "https://a.example/"],
	["?only", "https://a.example/p/q"],
	["http://example.com:80/"],
	["https://example.com/ü ö?ä=ß#€"],
	["https://xn--nxasmq6b.example/"],
	["https://例え.テスト/"],
	["file:///C:/dir/file.txt"],
	["mailto:someone@example.com"],
	["data:text/plain,hello"],
	["http://[::1]:3000/"],
	["http://192.168.0.255/"],
	["http://0x7f.1/"],
	["blob:https://a.example/uuid"],
	["https://a.example/?a=1&a=2&b=%20+"],
	["  https://a.example/trim  "],
];

describe("URL", () => {
	it.each(CASES)("parses %j (base %j) as Node's does", (input, base) => {
		const { URL } = filled();
		const ours = new URL(input, base);
		const theirs = new NodeURL(input, base);
		for (const field of FIELDS) {
			if (field === "origin" && input.startsWith("blob:")) continue;
			expect(ours[field], field).toBe(theirs[field]);
		}
		expect(ours.toString()).toBe(theirs.toString());
		expect(ours.toJSON()).toBe(theirs.toJSON());
	});

	it.each([
		"no scheme",
		"https://exa mple.com/",
		"http://[::1/",
		"https://a.example:99999/",
		"http://192.168.0.257/",
	])("refuses %j with a TypeError, as Node's does", (input) => {
		const { URL } = filled();
		expect(() => new URL(input)).toThrow(TypeError);
		expect(() => new NodeURL(input)).toThrow(TypeError);
		expect(URL.canParse(input)).toBe(false);
	});

	it("sets its parts as Node's does", () => {
		const { URL } = filled();
		const ours = new URL("https://a.example/p?q=1#h");
		const theirs = new NodeURL("https://a.example/p?q=1#h");
		for (const each of [ours, theirs]) {
			each.pathname = "/new path";
			each.search = "x=1 2";
			each.hash = "frag";
			each.port = "8443";
			each.hostname = "b.example";
		}
		expect(ours.href).toBe(theirs.href);
	});

	it("keeps its searchParams in step with its search", () => {
		const { URL, URLSearchParams } = filled();
		const url = new URL("https://a.example/?a=1");
		expect(url.searchParams).toBeInstanceOf(URLSearchParams);
		url.searchParams.append("b", "x y");
		expect(url.search).toBe("?a=1&b=x+y");
		url.search = "?c=3";
		expect(url.searchParams.get("c")).toBe("3");
		expect(URL.parse("nope")).toBeNull();
	});
});

describe("URLSearchParams", () => {
	it.each([["a=1&b=2&a=3"], ["?x=%20y+z&empty=&=novalue&k"], ["q=%E2%82%AC&q=%zz"]])(
		"parses and serializes %j as Node's does",
		(input) => {
			const { URLSearchParams } = filled();
			const ours = new URLSearchParams(input);
			const theirs = new NodeURLSearchParams(input);
			expect([...ours]).toEqual([...theirs]);
			expect(ours.toString()).toBe(theirs.toString());
		},
	);

	it("takes pairs and records, sorts stably, and answers size and has with a value", () => {
		const { URLSearchParams } = filled();
		const params = new URLSearchParams([
			["b", "2"],
			["a", "1"],
			["b", "1"],
		]);
		params.sort();
		expect(params.toString()).toBe("a=1&b=2&b=1");
		expect(params.size).toBe(3);
		expect(params.has("b", "1")).toBe(true);
		params.delete("b", "2");
		expect(params.getAll("b")).toEqual(["1"]);
		expect(new URLSearchParams({ x: "1", y: "€" }).toString()).toBe("x=1&y=%E2%82%AC");
	});
});

/** lynx-core's `URL` (modules/fetch/URL.js): no `pathname`, no `search`, nothing resolved. */
class LynxCoreUrl {
	href: string;
	constructor(url: string) {
		this.href = url;
	}
}

describe("the fill", () => {
	it("puts both on a thread that lacks them, made on first read", () => {
		const scope: Record<string, unknown> = {};
		fillUrl(scope);
		expect(Object.getOwnPropertyDescriptor(scope, "URL")?.get).toBeTypeOf("function");
		expect(Object.getOwnPropertyDescriptor(scope, "URLSearchParams")?.get).toBeTypeOf("function");
	});

	it("replaces lynx-core's URL and its URLSearchParams together", () => {
		const scope: Record<string, unknown> = {
			URL: LynxCoreUrl,
			URLSearchParams: NodeURLSearchParams,
		};
		fillUrl(scope);
		expect(scope["URL"]).not.toBe(LynxCoreUrl);
		expect(scope["URLSearchParams"]).not.toBe(NodeURLSearchParams);
	});

	it("leaves a thread's own that parses as the standard does", () => {
		const own = { URL: NodeURL, URLSearchParams: NodeURLSearchParams };
		const scope: Record<string, unknown> = { ...own };
		fillUrl(scope);
		expect(scope).toEqual(own);
	});
});
