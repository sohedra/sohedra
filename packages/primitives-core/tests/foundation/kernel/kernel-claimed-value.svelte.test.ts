// ClaimedValue: a slot the newest claim holds, released only by the token that holds it.
import { describe, expect, it } from "vitest";

import { ClaimedValue } from "../../../src/foundation/kernel/index.js";

describe("ClaimedValue", () => {
	it("is unclaimed at first", () => {
		expect(new ClaimedValue<string>().current).toBeUndefined();
	});

	it("is held by the newest claim; a stale release is ignored", () => {
		const slot = new ClaimedValue<string>();
		const releaseA = slot.claim({}, "a");
		const releaseB = slot.claim({}, "b");
		expect(slot.current).toBe("b");
		releaseA();
		expect(slot.current).toBe("b");
		releaseB();
		expect(slot.current).toBeUndefined();
	});

	it("lets the holder re-claim with a new value", () => {
		const slot = new ClaimedValue<string>();
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
