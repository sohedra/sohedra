// `URLPattern`, by urlpattern-polyfill, against the URL Pattern Standard, with Node's own (which
// passes the web platform tests) as the reference for every pattern.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { fillUrlPattern } from "../../../src/polyfill/web/url-pattern.ts";

const VENDORED = path.resolve(import.meta.dirname, "../../../src/polyfill/vendor/url-pattern.js");

/** The fill's class, put on a thread that lacks one. */
function filled(): typeof URLPattern {
	const scope: Record<string, unknown> = {};
	fillUrlPattern(scope);
	// Boundary: the global the fill installs.
	return scope["URLPattern"] as typeof URLPattern;
}

const Pattern = filled();

/** The same outcome: what `exec` gives, or an error of the same name. */
function outcome(run: () => unknown): unknown {
	try {
		return { value: JSON.parse(JSON.stringify(run()) ?? "null") };
	} catch (error) {
		return { error: (error as Error).name };
	}
}

const CASES: [input: URLPatternInput, base: string | undefined, url: string, options?: object][] = [
	[{ pathname: "/books/:id" }, undefined, "https://example.com/books/123"],
	[{ pathname: "/books/:id" }, undefined, "https://example.com/books"],
	["https://example.com/books/:id(\\d+)", undefined, "https://example.com/books/abc"],
	["https://example.com/books/:id(\\d+)", undefined, "https://example.com/books/42"],
	["/files/*", "https://example.com", "https://example.com/files/a/b.txt"],
	["https://*.example.com/:path*", undefined, "https://api.example.com/v1/users"],
	["https://example.com/:lang{/:page}?", undefined, "https://example.com/en"],
	["https://example.com/:lang{/:page}?", undefined, "https://example.com/en/about"],
	[{ search: "q=:query" }, undefined, "https://example.com/?q=lynx"],
	[{ hash: "section-:n" }, undefined, "https://example.com/#section-2"],
	[{ pathname: "/Books/:id" }, undefined, "https://example.com/books/1", { ignoreCase: true }],
	[{ pathname: "/Books/:id" }, undefined, "https://example.com/books/1"],
	["https://example.com:8080/*", undefined, "https://example.com:8080/x"],
	[{ protocol: "http{s}?" }, undefined, "http://example.com/"],
	["../relative", "https://example.com/a/b/", "https://example.com/relative"],
];

describe("URLPattern", () => {
	it.each(CASES)("matches %j (base %j) against %j as Node's does", (input, base, url, options) => {
		const make = (Class: typeof URLPattern) =>
			base === undefined
				? new Class(input, options as URLPatternOptions)
				: new Class(input as string, base, options as URLPatternOptions);
		expect(outcome(() => make(Pattern).exec(url))).toEqual(
			outcome(() => make(URLPattern).exec(url)),
		);
		expect(outcome(() => make(Pattern).test(url))).toEqual(
			outcome(() => make(URLPattern).test(url)),
		);
	});

	it("gives a pattern's components as Node's does", () => {
		const pattern = new Pattern("https://:sub.example.com/books/:id/\\?q=:q#:h");
		const own = new URLPattern("https://:sub.example.com/books/:id/\\?q=:q#:h");
		for (const key of ["protocol", "hostname", "pathname", "search", "hash"] as const)
			expect(pattern[key]).toBe(own[key]);
	});

	it("matches with a base URL given to exec", () => {
		const pattern = new Pattern({ pathname: "/a/:b" });
		expect(pattern.exec("/a/c", "https://example.com")?.pathname.groups).toEqual({ b: "c" });
	});

	it("refuses a pattern the standard refuses with a TypeError", () => {
		expect(() => new Pattern("https://example.com/:id(")).toThrow(TypeError);
		expect(() => new Pattern("/relative")).toThrow(TypeError);
	});

	it("takes group names of letters outside ASCII, which it checks with expressions written out at vendoring", () => {
		const match = new Pattern({ pathname: "/:café/:日本" }).exec({ pathname: "/a/b" });
		expect(match?.pathname.groups).toEqual({ café: "a", 日本: "b" });
		expect(() => new Pattern({ pathname: "/:a-b" }).exec({ pathname: "/x" })).not.toThrow();
	});

	it("ships no Unicode property escape, which PrimJS refuses", () => {
		const code = fs.readFileSync(VENDORED, "utf8");
		expect(code).not.toMatch(/\\[pP]\{/);
	});
});

describe("the fill", () => {
	it("puts URLPattern on a thread that lacks it, made on first read, named as the standard's", () => {
		const scope: Record<string, unknown> = {};
		fillUrlPattern(scope);
		expect(Object.getOwnPropertyDescriptor(scope, "URLPattern")?.get).toBeTypeOf("function");
		const Class = scope["URLPattern"] as typeof URLPattern;
		expect(Class.name).toBe("URLPattern");
		expect(Object.prototype.toString.call(new Class({}))).toBe("[object URLPattern]");
	});

	it("leaves a thread's own", () => {
		const scope: Record<string, unknown> = { URLPattern };
		fillUrlPattern(scope);
		expect(scope["URLPattern"]).toBe(URLPattern);
	});
});
