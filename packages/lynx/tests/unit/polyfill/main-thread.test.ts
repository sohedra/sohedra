// The main thread's fills, run as its runtime starts: on a global object shaped like a device's, and
// never over what the engine has. The language fills go on this process's own built-ins, which have
// them all: their own tests take them away (language/*.test.ts).

import { afterEach, describe, expect, it } from "@rstest/core";

import { fillSystemInfo } from "../../../src/main-thread/system-info.ts";
import { fillMainThread, setErrorHook } from "../../../src/polyfill/main-thread.ts";

afterEach(() => {
	setErrorHook(undefined);
});

/** A device's main thread: the global object has none of the fills. */
function device() {
	const scope: Record<string, unknown> = {};
	fillMainThread({ scope });
	return { scope };
}

describe("on a main thread that lacks them", () => {
	it("puts the same globals as the background", () => {
		const { scope } = device();
		expect(Object.getOwnPropertyNames(scope).sort()).toEqual([
			"EventTarget",
			"atob",
			"btoa",
			"queueMicrotask",
			"structuredClone",
		]);
	});

	it("queues a microtask as a promise's reaction, and sends what it throws to the error hook", async () => {
		const caught: unknown[] = [];
		setErrorHook((error) => caught.push(error));
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
		const own = () => "";
		const scope: Record<string, unknown> = {
			EventTarget: own,
			structuredClone: own,
			queueMicrotask: own,
			atob: (data: string) => globalThis.atob(data),
			btoa: (data: string) => globalThis.btoa(data),
		};
		const before = { ...scope };
		fillMainThread({ scope });
		expect(scope).toEqual(before);
	});
});

describe("the main thread's SystemInfo", () => {
	it("is lynx's, put on the global object, where the background has its own", () => {
		const info = { platform: "iOS" };
		const scope: Record<string, unknown> = {};
		fillSystemInfo({ scope, lynx: { SystemInfo: info } });
		expect(scope["SystemInfo"]).toBe(info);
	});

	it("is the engine's own when it has one", () => {
		const own = { platform: "Android" };
		const scope: Record<string, unknown> = { SystemInfo: own };
		fillSystemInfo({ scope, lynx: { SystemInfo: { platform: "iOS" } } });
		expect(scope["SystemInfo"]).toBe(own);
	});

	it("is not made up when lynx has none either", () => {
		const scope: Record<string, unknown> = {};
		fillSystemInfo({ scope, lynx: {} });
		expect("SystemInfo" in scope).toBe(false);
	});
});
