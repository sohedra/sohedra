// The background's fills, run before the page loads: on a global object and a `lynx` shaped like a
// device's, and never over what the engine has. The language fills go on this process's own
// built-ins, which have them all: their own tests take them away (language/*.test.ts).

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { fillBackground } from "../../src/fills/background.ts";
import type { ThreadLynx } from "../../src/fills/globals.ts";
import { deserialize, serialize } from "../../src/fills/vendor/structured-clone.js";
import { hearReports, stopHearing } from "./reports.ts";

// These tests check where the fills go and what reaches `@ungap/structured-clone`'s own copy; each
// fill's own tests check what it does, and tests/package/ runs each import's built script in a
// realm shaped like a thread's.
rs.mock("../../src/fills/vendor/structured-clone.js", { spy: true });
afterEach(() => {
	rs.clearAllMocks();
	stopHearing();
});

/** lynx-core's `Promise`: the engine's, without ES2021's to ES2025's statics. */
function lynxCorePromise(): PromiseConstructor {
	class LynxPromise<T> extends Promise<T> {}
	for (const name of ["any", "allSettled", "withResolvers", "try"])
		void Object.defineProperty(LynxPromise, name, {
			value: undefined,
			configurable: true,
			writable: true,
		});
	return LynxPromise;
}

/** A device's background: `lynx` alone has the microtask queue, and lynx-core's `Promise`. */
function device() {
	const calls: unknown[][] = [];
	const lynx: ThreadLynx = {
		Promise: lynxCorePromise(),
		queueMicrotask: (callback: () => void) => void calls.push(["queueMicrotask", callback]),
		reportError: (error: unknown) => void calls.push(["reportError", error]),
	};
	const scope: Record<string, unknown> = {};
	fillBackground({ scope, readLynx: () => lynx, timers: TIMERS, console: {} as never });
	return { calls, scope, lynx };
}

/** The timers lynx-core passes the bundle by name. */
const TIMERS = { setTimeout, clearTimeout, setInterval, clearInterval };

/** What the background's fills put on its global object. */
const BACKGROUND_GLOBALS = [
	"AbortController",
	"AbortSignal",
	"Blob",
	"ByteLengthQueuingStrategy",
	"CountQueuingStrategy",
	"CustomEvent",
	"DOMException",
	"ErrorEvent",
	"Event",
	"EventTarget",
	"File",
	"FormData",
	"Headers",
	"Performance",
	"PerformanceEntry",
	"PerformanceMark",
	"PerformanceMeasure",
	"PromiseRejectionEvent",
	"ReadableByteStreamController",
	"ReadableStream",
	"ReadableStreamBYOBReader",
	"ReadableStreamBYOBRequest",
	"ReadableStreamDefaultController",
	"ReadableStreamDefaultReader",
	"Request",
	"Response",
	"TextDecoder",
	"TextDecoderStream",
	"TextEncoder",
	"TextEncoderStream",
	"TransformStream",
	"TransformStreamDefaultController",
	"URL",
	"URLSearchParams",
	"WritableStream",
	"WritableStreamDefaultController",
	"WritableStreamDefaultWriter",
	"addEventListener",
	"atob",
	"btoa",
	"clearInterval",
	"clearTimeout",
	"dispatchEvent",
	"fetch",
	"navigator",
	"onerror",
	"performance",
	"queueMicrotask",
	"removeEventListener",
	"reportError",
	"self",
	"setInterval",
	"setTimeout",
	"structuredClone",
];

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
		hearReports(caught);
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

	it("puts its globals on the global object, not enumerable, with the timers the bundle's wrapper passes", () => {
		const { scope } = device();
		expect(Object.getOwnPropertyNames(scope).sort()).toEqual(BACKGROUND_GLOBALS);
		expect(Object.keys(scope)).toEqual([]);
		expect(scope["setTimeout"]).toBe(setTimeout);
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

	it("gives lynx-core's Promise, which the bundle names, the statics it lacks", () => {
		const { lynx } = device();
		// Boundary: ES2024's and ES2025's statics, which this package's types leave out.
		const statics = lynx.Promise as unknown as Record<string, unknown>;
		for (const name of ["any", "allSettled", "withResolvers", "try"])
			expect(statics[name], name).toBeTypeOf("function");
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

describe("on a background that has them", () => {
	it("leaves the engine's own, and lynx-core's Promise's own statics", () => {
		// The test page's globals, which follow the standards.
		const own = globalThis as unknown as Record<string, unknown>;
		const scope: Record<string, unknown> = Object.fromEntries(
			BACKGROUND_GLOBALS.map((name) => [name, own[name]]),
		);
		const before = { ...scope };
		const kept = () => {};
		const statics = { any: kept, allSettled: kept, withResolvers: kept, try: kept };
		const PromiseClass = Object.assign(lynxCorePromise(), statics);
		fillBackground({
			scope,
			readLynx: () => ({ Promise: PromiseClass, reportError: kept }),
			timers: TIMERS,
			console,
		});
		expect(scope).toEqual(before);
		// Boundary: the statics, read by name.
		const read = PromiseClass as unknown as Record<string, unknown>;
		for (const name of Object.keys(statics)) expect(read[name], name).toBe(kept);
	});
});
