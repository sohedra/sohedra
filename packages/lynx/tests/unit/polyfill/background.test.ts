// The background's fills, run before the page loads: on a global object and a strings' prototype
// shaped like a device's, and never over what the engine has.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { fillEngineGaps } from "../../../src/background/engine-gaps.ts";
import { fillBackground, setErrorHook } from "../../../src/polyfill/background.ts";
import type { ThreadLynx } from "../../../src/polyfill/globals.ts";
import { deserialize, serialize } from "../../../src/polyfill/vendor/structured-clone.js";
import { installGlobals } from "../../../src/testing/globals.ts";

// In Node, `@ungap/event-target` hands back Node's own `EventTarget`, so these tests check where the
// fills go and what reaches `@ungap/structured-clone`'s own copy; the device-shaped build tests
// (tests/build/device-snapshot.test.ts) run the packages' own code.
rs.mock("../../../src/polyfill/vendor/structured-clone.js", { spy: true });
afterEach(() => {
	rs.clearAllMocks();
	setErrorHook(undefined);
});

/** A device's background: `lynx` alone has the microtask queue. */
function device() {
	const calls: unknown[][] = [];
	const lynx: ThreadLynx = {
		queueMicrotask: (callback: () => void) => void calls.push(["queueMicrotask", callback]),
		reportError: (error: unknown) => void calls.push(["reportError", error]),
	};
	const scope: Record<string, unknown> = {};
	const strings: Record<string, unknown> = {};
	fillBackground({ scope, strings, readLynx: () => lynx });
	return { calls, scope, strings };
}

describe("on a background that lacks them", () => {
	it("puts a global queueMicrotask that queues on lynx's", () => {
		const { calls, scope } = device();
		let ran = 0;
		(scope["queueMicrotask"] as (callback: () => void) => void)(() => ran++);
		expect(calls).toEqual([["queueMicrotask", expect.any(Function)]]);
		(calls[0]![1] as () => void)();
		expect(ran).toBe(1);
	});

	it("sends what a callback throws to the error hook, throws nothing, and runs the next", () => {
		const caught: unknown[] = [];
		setErrorHook((error) => caught.push(error));
		const { calls, scope } = device();
		const failure = new Error("an effect threw");
		let ran = 0;
		const queue = scope["queueMicrotask"] as (callback: () => void) => void;
		queue(() => {
			throw failure;
		});
		queue(() => ran++);
		for (const [, callback] of calls) expect(() => (callback as () => void)()).not.toThrow();
		expect(caught).toEqual([failure]);
		expect(ran).toBe(1);
	});

	it("refuses to queue what is not a function, as the standard does", () => {
		const { scope } = device();
		expect(() => (scope["queueMicrotask"] as (callback: unknown) => void)(1)).toThrow(TypeError);
	});

	it("puts its globals on the global object, not enumerable, and no timers: the bundle's wrapper passes them", () => {
		const { scope } = device();
		const names = Object.getOwnPropertyNames(scope).sort();
		expect(names).toEqual(["EventTarget", "atob", "btoa", "queueMicrotask", "structuredClone"]);
		expect(Object.keys(scope)).toEqual([]);
	});

	it("puts a global EventTarget, which Svelte's runtime tests values with", () => {
		const { scope } = device();
		const Target = scope["EventTarget"] as typeof EventTarget;
		const target = new Target();
		const heard: string[] = [];
		target.addEventListener("ping", (event) => heard.push(event.type));
		target.dispatchEvent(new Event("ping"));
		expect(heard).toEqual(["ping"]);
	});

	it("puts a global structuredClone, which Svelte's runtime copies state with", () => {
		const { scope } = device();
		const clone = scope["structuredClone"] as typeof structuredClone;
		const value = { when: new Date(0), sizes: new Map([["a", [1]]]), rows: [[1, [2]]] };
		const copy = clone(value);
		expect(copy).toEqual(value);
		expect(copy.when).not.toBe(value.when);
		expect(copy.sizes.get("a")).not.toBe(value.sizes.get("a"));
		expect(copy.rows[0]).not.toBe(value.rows[0]);
	});

	it("gives strings a replaceAll that is not enumerable, as the built-in is", () => {
		const { strings } = device();
		expect(Object.getOwnPropertyDescriptor(strings, "replaceAll")).toEqual({
			value: expect.any(Function),
			writable: true,
			enumerable: false,
			configurable: true,
		});
	});
});

describe("the structuredClone it gives", () => {
	const clone = device().scope["structuredClone"] as typeof structuredClone;

	it("returns a primitive as it is, as @ungap/structured-clone's own copy does, without serializing it", () => {
		const primitives = [undefined, null, true, false, 0, -0, NaN, Infinity, 1.5, 10n, "", "text"];
		for (const value of primitives) {
			expect(Object.is(clone(value), value)).toBe(true);
		}
		expect(serialize).not.toHaveBeenCalled();
		for (const value of primitives)
			expect(Object.is(deserialize(serialize(value)), value)).toBe(true);
	});

	it("hands a symbol, a function and every object to @ungap/structured-clone, with the options", () => {
		const symbol = Symbol("unique");
		const action = () => {};
		expect(() => clone(symbol)).toThrow();
		expect(() => clone(action)).toThrow();
		const value = { when: new Date(0) };
		const options = { json: false };
		expect(clone(value, options as StructuredSerializeOptions)).toEqual(value);
		const calls = [...rs.mocked(serialize).mock.calls];
		expect(calls.map(([handed]) => handed)).toEqual([symbol, action, value]);
		expect(calls[2]).toEqual([value, options]);
		expect(() => serialize(symbol)).toThrow(new TypeError("unable to serialize symbol"));
		expect(() => serialize(action)).toThrow(new TypeError("unable to serialize function"));
	});
});

describe("the replaceAll it gives", () => {
	const { strings } = device();
	const fill = strings["replaceAll"] as (
		this: unknown,
		search: unknown,
		replacement: unknown,
	) => string;

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
		["C:\\a\\b", "\\", "/"],
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
});

describe("on a background that has them", () => {
	it("leaves the engine's own, and reads nothing of lynx", () => {
		const own = () => {};
		const scope: Record<string, unknown> = {
			queueMicrotask: own,
			EventTarget: own,
			structuredClone: own,
			atob: (data: string) => globalThis.atob(data),
			btoa: (data: string) => globalThis.btoa(data),
		};
		const before = { ...scope };
		const strings = { replaceAll: own };
		fillBackground({
			scope,
			strings,
			readLynx: () => {
				throw new Error("lynx was read");
			},
		});
		expect(scope).toEqual(before);
		expect(strings.replaceAll).toBe(own);
	});
});

describe("the binding's fill of the background", () => {
	it("sends what the fills catch to the page's errors: into Lynx and to the page's onError", () => {
		const reported: unknown[] = [];
		const restore = installGlobals({
			lynx: { reportError: (error: unknown) => reported.push(error) },
		});
		try {
			const queued: (() => void)[] = [];
			const scope: Record<string, unknown> = {};
			fillEngineGaps({
				scope,
				strings: {},
				readLynx: () => ({ queueMicrotask: (run) => queued.push(run), reportError: () => {} }),
			});
			const failure = new Error("a microtask threw");
			(scope["queueMicrotask"] as (callback: () => void) => void)(() => {
				throw failure;
			});
			queued[0]!();
			expect(reported).toEqual([failure]);
		} finally {
			restore();
		}
	});
});

describe("the background's start", () => {
	it("fills the thread's own global object, leaves what this one has, and installs the lazy-bundle loader", async () => {
		const lynx: { loadLazyBundle?: unknown } = {};
		const restore = installGlobals({ lynx });
		try {
			const read = () => [
				globalThis.queueMicrotask,
				globalThis.setTimeout,
				globalThis.EventTarget,
				globalThis.structuredClone,
				globalThis.atob,
				globalThis.btoa,
				String.prototype.replaceAll,
			];
			const own = read();
			await import("../../../src/background/start-up.ts");
			expect(read()).toEqual(own);
			expect(typeof lynx.loadLazyBundle).toBe("function");
		} finally {
			restore();
		}
	});
});

describe("the reason for the queueMicrotask fill", () => {
	// A canary: the fill exists, and catches what a callback throws, because the background's
	// bundle gets no `queueMicrotask` from Lynx. Lynx hands the bundle its thread's functions as the
	// parameters of the function its runtime wrapper writes around it (setTimeout, setInterval…).
	// When the wrapper passes `queueMicrotask` too, the fill steps aside for Lynx's, and a throw
	// after a timer no longer reaches `onError`: the fill must then wrap Lynx's function instead of
	// standing in for it.
	it("is that Lynx's runtime wrapper passes the background's bundle no queueMicrotask", () => {
		const require = createRequire(import.meta.url);
		const folder = path.dirname(
			require.resolve("@lynx-js/runtime-wrapper-webpack-plugin/package.json"),
		);
		const source = fs.readFileSync(path.join(folder, "lib/RuntimeWrapperWebpackPlugin.js"), "utf8");
		expect(source).toContain("'setTimeout',");
		expect(source).not.toMatch(/['"]queueMicrotask['"]/);
	});
});
