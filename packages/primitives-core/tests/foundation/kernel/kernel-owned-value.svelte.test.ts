// OwnedValue: a slot the newest claim owns, released only by its owner.
import { describe, expect, it } from "vitest";

import { OwnedValue } from "../../../src/foundation/kernel/index.js";

describe("OwnedValue", () => {
	it("is unclaimed at first", () => {
		expect(new OwnedValue<string>().current).toBeUndefined();
	});

	it("is owned by the newest claim; a stale release is ignored", () => {
		const slot = new OwnedValue<string>();
		const releaseA = slot.claim({}, "a");
		const releaseB = slot.claim({}, "b");
		expect(slot.current).toBe("b");
		releaseA();
		expect(slot.current).toBe("b");
		releaseB();
		expect(slot.current).toBeUndefined();
	});

	it("lets the owner re-claim with a new value", () => {
		const slot = new OwnedValue<string>();
		const token = {};
		const first = slot.claim(token, "a");
		const second = slot.claim(token, "b");
		expect(slot.current).toBe("b");
		// Same token: either release clears the slot.
		first();
		expect(slot.current).toBeUndefined();
		second();
		expect(slot.current).toBeUndefined();
	});
});
