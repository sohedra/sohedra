// The environment core tests run in: the timer globals are stubs that throw, the shared setup runs,
// and the fake platform refuses questions a test didn't script and steps its scheduler by hand.
import { describe, expect, it } from "vitest";

import { createFakePlatform } from "./kit-fake-platform.js";

// The shared setup sets this global; the web package declares its type, which this package does
// not see.
declare global {
	var SOHEDRA_ANIMATIONS_DISABLED: boolean | undefined;
}

describe("core test environment", () => {
	it("replaces the timer globals with stubs that throw", () => {
		expect(() => setTimeout(() => {}, 0)).toThrow(/platform's scheduler/);
		expect(() => requestAnimationFrame(() => {})).toThrow(/platform's scheduler/);
		expect(() => performance.now()).toThrow(/platform's scheduler/);
		// The shared setup runs too.
		expect(globalThis.SOHEDRA_ANIMATIONS_DISABLED).toBe(true);
	});

	it("throws on platform services a test didn't script", () => {
		const platform = createFakePlatform({ order: { compare: () => -1 } });
		expect(platform.order.compare({}, {})).toBe(-1);
		expect(() => platform.focus.focus({})).toThrow(/Unexpected platform call: focus.focus/);
		expect(() => platform.form.requestSubmit({})).toThrow(/form.requestSubmit/);
		expect(() => platform.locale.collator("en")).toThrow(/locale.collator/);
	});
});

describe("fake scheduler", () => {
	it("runs timeouts in time order, frames per call and microtasks until empty", () => {
		const { scheduler } = createFakePlatform();
		const calls: string[] = [];
		scheduler.timeout(() => calls.push("b"), 20);
		scheduler.timeout(() => {
			calls.push("a");
			scheduler.timeout(() => calls.push("a2"), 5);
		}, 10);
		const cancel = scheduler.timeout(() => calls.push("canceled"), 1);
		cancel();
		scheduler.advance(19);
		expect(calls).toEqual(["a", "a2"]);
		expect(scheduler.now()).toBe(19);
		scheduler.advance(1);
		expect(calls).toEqual(["a", "a2", "b"]);

		scheduler.frame(() => {
			calls.push("frame");
			scheduler.frame(() => calls.push("next frame"));
		});
		scheduler.runFrames();
		expect(calls.at(-1)).toBe("frame");
		scheduler.runFrames();
		expect(calls.at(-1)).toBe("next frame");

		scheduler.microtask(() => {
			calls.push("micro");
			scheduler.microtask(() => calls.push("micro 2"));
		});
		scheduler.runMicrotasks();
		expect(calls.slice(-2)).toEqual(["micro", "micro 2"]);
	});
});
