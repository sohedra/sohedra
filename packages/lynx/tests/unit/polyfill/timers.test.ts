// The timers on the global object, WinterTC § 6: the background's, which its code reads by name.

import { describe, expect, it } from "@rstest/core";

import type { ThreadTimers } from "../../../src/polyfill/globals.ts";
import { fillTimers } from "../../../src/polyfill/web/timers.ts";

const timers: ThreadTimers = {
	setTimeout: () => 1,
	clearTimeout: () => {},
	setInterval: () => 2,
	clearInterval: () => {},
};

describe("the fill", () => {
	it("puts the thread's own timers on the global object, not enumerable", () => {
		const scope: Record<string, unknown> = {};
		fillTimers(scope, timers);
		for (const [name, timer] of Object.entries(timers)) expect(scope[name], name).toBe(timer);
		expect(Object.keys(scope)).toEqual([]);
	});

	it("leaves a timer the global object has, and puts none the thread lacks", () => {
		const own = () => 3;
		const scope: Record<string, unknown> = { setTimeout: own };
		fillTimers(scope, {
			...timers,
			setInterval: undefined as unknown as ThreadTimers["setInterval"],
		});
		expect(scope["setTimeout"]).toBe(own);
		expect("setInterval" in scope).toBe(false);
		expect(scope["clearTimeout"]).toBe(timers.clearTimeout);
	});
});
