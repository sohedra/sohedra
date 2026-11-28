// inertPlatform: the platform of a store no platform runs yet, which never runs a callback, stands still
// and answers nothing.
import { describe, expect, it, vi } from "vitest";

import { inertPlatform } from "../../../src/foundation/kernel/index.js";

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
