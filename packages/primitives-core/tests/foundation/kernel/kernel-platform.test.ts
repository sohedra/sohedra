// The platform core tests run on: the timer globals throw, the shared setup still runs, the
// fake platform refuses unscripted questions, and `Timeout` drops a late or replaced callback.

import { describe, expect, it, vi } from "vitest";

import { inertPlatform, Timeout } from "../../../src/foundation/kernel/index.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";

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

describe("Timeout", () => {
	it("restarts, clears, and reports whether it is pending", () => {
		const { scheduler } = createFakePlatform();
		const timeout = new Timeout(scheduler);
		const callback = vi.fn();
		timeout.start(100, callback);
		expect(timeout.isStarted()).toBe(true);
		scheduler.advance(50);
		timeout.start(100, callback);
		scheduler.advance(99);
		expect(callback).not.toHaveBeenCalled();
		scheduler.advance(1);
		expect(callback).toHaveBeenCalledOnce();
		expect(timeout.isStarted()).toBe(false);
		timeout.start(10, callback);
		timeout.clear();
		scheduler.advance(10);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("drops a callback the platform delivers after it was cleared or replaced", () => {
		const delivered: (() => void)[] = [];
		// A platform whose cancel doesn't stop delivery: the generation token must.
		const timeout = new Timeout({
			...createFakePlatform().scheduler,
			timeout: (callback) => {
				delivered.push(callback);
				return () => {};
			},
		});
		const first = vi.fn();
		const second = vi.fn();
		timeout.start(10, first);
		timeout.start(10, second);
		delivered.forEach((deliver) => deliver());
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
		timeout.start(10, first);
		timeout.clear();
		delivered.at(-1)?.();
		expect(first).not.toHaveBeenCalled();
	});
});

describe("inertPlatform", () => {
	it("never runs callbacks, stands still and answers nothing", () => {
		const callback = vi.fn();
		inertPlatform.scheduler.timeout(callback, 0)();
		inertPlatform.scheduler.frame(callback)();
		inertPlatform.scheduler.microtask(callback)();
		expect(callback).not.toHaveBeenCalled();
		expect(inertPlatform.scheduler.now()).toBe(0);
		expect(inertPlatform.order.compare({}, {})).toBe(0);
		expect(() => inertPlatform.locale.numberFormat("en")).toThrow(/no locale/);
	});
});
