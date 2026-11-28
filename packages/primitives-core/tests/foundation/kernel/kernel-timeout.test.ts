// Timeout: one pending callback on the platform's scheduler, restarted, cleared, and safe from a
// late or replaced delivery.
import { describe, expect, it, vi } from "vitest";

import { Timeout } from "../../../src/foundation/kernel/index.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";

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
