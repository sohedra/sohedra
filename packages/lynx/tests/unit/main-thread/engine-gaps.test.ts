// What the main thread's engine lacks, filled in before the page loads: on a global object and a
// strings' prototype shaped like a device's, and never over what the engine has.

import { afterEach, describe, expect, it, rs } from "@rstest/core";
import structuredCloneFill, { deserialize, serialize } from "@ungap/structured-clone";

import { fillEngineGaps } from "../../../src/main-thread/engine-gaps.ts";

// In Node, `@ungap/event-target` and `@ungap/structured-clone` hand back Node's own `EventTarget`
// and `structuredClone`, so these tests check where the fills go and what reaches them; the
// device-shaped build tests (tests/build/device-snapshot.test.ts) run the packages' own code.
rs.mock("@ungap/structured-clone", { spy: true });
afterEach(() => {
	rs.clearAllMocks();
});

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

describe("the main thread's EventTarget and structuredClone, which Svelte's runtime reads as it copies state in the first frame", () => {
	it("are put on a global object that lacks them", () => {
		const { scope } = device();
		const Target = scope["EventTarget"] as typeof EventTarget;
		const heard: string[] = [];
		const target = new Target();
		target.addEventListener("ping", (event) => heard.push(event.type));
		target.dispatchEvent(new Event("ping"));
		expect(heard).toEqual(["ping"]);
		const clone = scope["structuredClone"] as typeof structuredClone;
		const value = { when: new Date(0), rows: [[1, [2]]] };
		const copy = clone(value);
		expect(copy).toEqual(value);
		expect(copy.when).not.toBe(value.when);
		expect(copy.rows[0]).not.toBe(value.rows[0]);
	});

	it("are the engine's own when it has them", () => {
		const own = () => {};
		const scope: Record<string, unknown> = { EventTarget: own, structuredClone: own };
		fillEngineGaps({ scope, strings: {}, lynx: {} });
		expect(scope).toEqual({ EventTarget: own, structuredClone: own });
	});

	it("return a primitive as it is, as @ungap/structured-clone's own copy does, without serializing it", () => {
		const clone = device().scope["structuredClone"] as typeof structuredClone;
		const primitives = [undefined, null, true, false, 0, -0, NaN, Infinity, 1.5, 10n, "", "text"];
		for (const value of primitives) {
			expect(Object.is(clone(value), value)).toBe(true);
			expect(Object.is(deserialize(serialize(value)), value)).toBe(true);
		}
		expect(structuredCloneFill).not.toHaveBeenCalled();
	});

	it("hand a symbol, a function and every object to @ungap/structured-clone, with the options", () => {
		const clone = device().scope["structuredClone"] as typeof structuredClone;
		const symbol = Symbol("unique");
		const action = () => {};
		expect(() => clone(symbol)).toThrow();
		expect(() => clone(action)).toThrow();
		expect(() => serialize(symbol)).toThrow(new TypeError("unable to serialize symbol"));
		expect(() => serialize(action)).toThrow(new TypeError("unable to serialize function"));
		const value = { when: new Date(0) };
		const options = { transfer: [] };
		expect(clone(value, options)).toEqual(value);
		const calls = rs.mocked(structuredCloneFill).mock.calls;
		expect(calls.map(([handed]) => handed)).toEqual([symbol, action, value]);
		expect(calls[2]).toEqual([value, options]);
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
