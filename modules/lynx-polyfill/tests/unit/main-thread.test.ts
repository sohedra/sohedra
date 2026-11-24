// The main thread's fills, run as its runtime starts: on a global object shaped like a device's, and
// never over what the engine has. The language fills go on this process's own built-ins, which have
// them all: their own tests take them away (language/*.test.ts).

import { afterEach, describe, expect, it } from "@rstest/core";

import { fillMainThread } from "../../src/fills/main-thread.ts";
import { hearReports, stopHearing } from "./reports.ts";

afterEach(() => {
	stopHearing();
});

/** A device's main thread: the global object has none of the fills. */
function device() {
	const scope: Record<string, unknown> = {};
	fillMainThread({ scope, console: {} as never });
	return { scope };
}

/** What the main thread's fills put on its global object. */
const MAIN_THREAD_GLOBALS = [
	"AbortController",
	"AbortSignal",
	"CustomEvent",
	"DOMException",
	"ErrorEvent",
	"Event",
	"EventTarget",
	"Headers",
	"Performance",
	"PerformanceEntry",
	"PerformanceMark",
	"PerformanceMeasure",
	"PromiseRejectionEvent",
	"Request",
	"Response",
	"TextDecoder",
	"TextEncoder",
	"URL",
	"URLSearchParams",
	"addEventListener",
	"atob",
	"btoa",
	"dispatchEvent",
	"fetch",
	"navigator",
	"onerror",
	"performance",
	"queueMicrotask",
	"removeEventListener",
	"reportError",
	"self",
	"structuredClone",
];

describe("on a main thread that lacks them", () => {
	it("puts the background's globals but the streams, Blob, File, FormData and the timers", () => {
		const { scope } = device();
		expect(Object.getOwnPropertyNames(scope).sort()).toEqual(MAIN_THREAD_GLOBALS);
	});

	it("queues a microtask as a promise's reaction, and sends what it throws to the error hook", async () => {
		const caught: unknown[] = [];
		hearReports(caught);
		const { scope } = device();
		const queue = scope["queueMicrotask"] as (callback: () => void) => void;
		const order: string[] = [];
		const failure = new Error("a main-thread microtask threw");
		queue(() => {
			order.push("first");
			throw failure;
		});
		queue(() => order.push("second"));
		order.push("sync");
		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual(["sync", "first", "second"]);
		expect(caught).toEqual([failure]);
	});

	it("copies state with structuredClone, and tests it with EventTarget, in the first frame", () => {
		const { scope } = device();
		const Target = scope["EventTarget"] as typeof EventTarget;
		expect(new Target()).toBeInstanceOf(Target);
		const clone = scope["structuredClone"] as typeof structuredClone;
		const value = { when: new Date(0), rows: [[1, [2]]] };
		const copy = clone(value);
		expect(copy).toEqual(value);
		expect(copy.when).not.toBe(value.when);
	});
});

describe("on a main thread that has them", () => {
	it("leaves the engine's own", () => {
		// The test page's globals, which follow the standards.
		const own = globalThis as unknown as Record<string, unknown>;
		const scope: Record<string, unknown> = Object.fromEntries(
			MAIN_THREAD_GLOBALS.map((name) => [name, own[name]]),
		);
		const before = { ...scope };
		fillMainThread({ scope, console });
		expect(scope).toEqual(before);
	});
});
