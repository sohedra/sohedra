// What the main thread's engine lacks, filled in before the page loads: on a global object and a
// strings' prototype shaped like a device's, and never over what the engine has.

import { describe, expect, it } from "@rstest/core";

import { fillEngineGaps } from "../../../src/main-thread/engine-gaps.ts";

/** A device's main thread: `lynx` has `SystemInfo`, the global object and strings have neither. */
function device(lynx: { SystemInfo?: unknown } = {}) {
	const scope: Record<string, unknown> = {};
	const strings: Record<string, unknown> = {};
	fillEngineGaps({ scope, strings, lynx });
	return { scope, strings };
}

describe("the main thread's SystemInfo", () => {
	it("is lynx's, put on the global object, where the background has its own", () => {
		const info = { platform: "iOS" };
		expect(device({ SystemInfo: info }).scope["SystemInfo"]).toBe(info);
	});

	it("is the engine's own when it has one", () => {
		const own = { platform: "Android" };
		const scope: Record<string, unknown> = { SystemInfo: own };
		fillEngineGaps({ scope, strings: {}, lynx: { SystemInfo: { platform: "iOS" } } });
		expect(scope["SystemInfo"]).toBe(own);
	});

	it("is not made up when lynx has none either", () => {
		expect("SystemInfo" in device().scope).toBe(false);
	});
});

describe("the main thread's replaceAll, which Svelte's server runtime uses in the first frame", () => {
	const { strings } = device();
	const fill = strings["replaceAll"] as (
		this: unknown,
		search: unknown,
		replacement: unknown,
	) => string;

	it("is given to strings that lack it, not enumerable, as the built-in is", () => {
		expect(Object.getOwnPropertyDescriptor(strings, "replaceAll")).toEqual({
			value: expect.any(Function),
			writable: true,
			enumerable: false,
			configurable: true,
		});
	});

	it.each([
		["a.b.a", "a", "x"],
		["aaaa", "aa", "b"],
		["abc", "", "-"],
		["", "", "-"],
		["", "a", "-"],
		["no match", "z", "-"],
		["a.b.a", ".", "$$"],
		["a.b.a", "b", "[$&]"],
		["a.b.a", "b", "[$`]"],
		["a.b.a", "b", "[$']"],
		["a.b.a", "b", "$1$<n>$"],
		["a/*x*/b/*y*/", /\/\*.*?\*\//g, ""],
		["aXbX", /x/gi, "$&$&"],
		["<p><!----></p>", "<!---->", ""],
	])("replaces in %j every %s with %j as the built-in does", (text, search, replacement) => {
		expect(fill.call(text, search, replacement)).toBe(
			text.replaceAll(search as string, replacement),
		);
	});

	it("calls a function for each match with the match, its position and the text", () => {
		const seen: unknown[][] = [];
		const result = fill.call("a-b-a", "a", (...args: unknown[]) => {
			seen.push(args);
			return "A";
		});
		expect(result).toBe("A-b-A");
		expect(seen).toEqual([
			["a", 0, "a-b-a"],
			["a", 4, "a-b-a"],
		]);
	});

	it("refuses a regular expression that is not global, and a missing string", () => {
		expect(() => fill.call("a", /a/, "b")).toThrow(TypeError);
		expect(() => fill.call(undefined, "a", "b")).toThrow(TypeError);
	});

	it("leaves the engine's own", () => {
		const own = () => "";
		const strings = { replaceAll: own };
		fillEngineGaps({ scope: {}, strings, lynx: {} });
		expect(strings.replaceAll).toBe(own);
	});
});
