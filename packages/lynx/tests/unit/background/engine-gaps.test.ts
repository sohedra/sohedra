// What the background's engine lacks, filled in before the page loads: on a global object and a
// strings' prototype shaped like a device's, and never over what the engine has.

import { describe, expect, it } from "@rstest/core";

import { fillEngineGaps } from "../../../src/background/engine-gaps.ts";
import type { BackgroundGlobals } from "../../../src/background/globals.ts";

/** A device's background: `lynx` alone has the timers and the microtask queue. */
function device() {
	const calls: unknown[][] = [];
	const lynx = {
		queueMicrotask: (callback: () => void) => calls.push(["queueMicrotask", callback]),
		setTimeout: (callback: () => void, delay?: number) => {
			calls.push(["setTimeout", callback, delay]);
			return 11;
		},
		clearTimeout: (id: number) => calls.push(["clearTimeout", id]),
		setInterval: (callback: () => void, delay?: number) => {
			calls.push(["setInterval", callback, delay]);
			return 12;
		},
		clearInterval: (id: number) => calls.push(["clearInterval", id]),
	};
	const scope: Record<string, unknown> = {};
	const strings: Record<string, unknown> = {};
	// Boundary: the fills use only these members of `lynx`.
	const globals = { lynx } as unknown as BackgroundGlobals;
	fillEngineGaps({ scope, strings, globals });
	return { calls, scope, strings };
}

describe("on a background that lacks them", () => {
	it("puts a global queueMicrotask that queues on lynx's", () => {
		const { calls, scope } = device();
		const callback = () => {};
		(scope["queueMicrotask"] as (callback: () => void) => void)(callback);
		expect(calls).toEqual([["queueMicrotask", callback]]);
	});

	it("puts lynx's timers on the global object, answering what they answer", () => {
		const { calls, scope } = device();
		const callback = () => {};
		const call = (name: string, ...args: unknown[]) =>
			(scope[name] as (...args: unknown[]) => unknown)(...args);
		expect(call("setTimeout", callback, 5)).toBe(11);
		call("clearTimeout", 11);
		expect(call("setInterval", callback, 7)).toBe(12);
		call("clearInterval", 12);
		expect(calls).toEqual([
			["setTimeout", callback, 5],
			["clearTimeout", 11],
			["setInterval", callback, 7],
			["clearInterval", 12],
		]);
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
	it("leaves the engine's own", () => {
		const own = () => {};
		const scope: Record<string, unknown> = {
			queueMicrotask: own,
			setTimeout: own,
			clearTimeout: own,
			setInterval: own,
			clearInterval: own,
		};
		const strings = { replaceAll: own };
		// Boundary: nothing of `lynx` is read when the engine has every global.
		fillEngineGaps({ scope, strings, globals: {} as BackgroundGlobals });
		expect(Object.values(scope).every((value) => value === own)).toBe(true);
		expect(strings.replaceAll).toBe(own);
	});
});
