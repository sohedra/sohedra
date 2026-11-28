// The popup rules as facts in and an outcome out: click-like events, the open event to keep, a
// request naming or moving to another trigger, the press toggle, the instant type to show or set,
// the exit gate, and what a session follows of an `open` set from outside.
import { describe, expect, it } from "vitest";

import { REASONS } from "../../../src/foundation/kernel/index.js";
import { pressOpenState } from "../../../src/foundation/popup/index.js";
import {
	awaitsUnmount,
	closesUnheard,
	isClickLikeEventType,
	keepsOpenEvent,
	movesToOtherTrigger,
	namesOtherTrigger,
	openValuesToFollow,
	visibleInstantType,
} from "../../../src/foundation/popup/popup-rules.js";

describe("isClickLikeEventType", () => {
	it("takes presses and keys as click-like", () => {
		expect(isClickLikeEventType("click")).toBe(true);
		expect(isClickLikeEventType("mousedown")).toBe(true);
		expect(isClickLikeEventType("keydown")).toBe(true);
		expect(isClickLikeEventType("keyup")).toBe(true);
		expect(isClickLikeEventType("mouseenter")).toBe(false);
		expect(isClickLikeEventType(REASONS.imperativeAction)).toBe(false);
		expect(isClickLikeEventType(undefined)).toBe(false);
	});
});

describe("keepsOpenEvent", () => {
	it("keeps the open event only for a hover-like opening of an open popup", () => {
		expect(keepsOpenEvent(true, true, "mouseenter")).toBe(true);
		expect(keepsOpenEvent(true, true, undefined)).toBe(true);
		// A click-like event upgrades it, an opening of a closed popup records it, a close forgets it.
		expect(keepsOpenEvent(true, true, "click")).toBe(false);
		expect(keepsOpenEvent(true, false, "mouseenter")).toBe(false);
		expect(keepsOpenEvent(false, true, "mouseenter")).toBe(false);
	});

	it("records a new open event when the opening moves the popup to another trigger", () => {
		expect(keepsOpenEvent(true, true, "mouseenter", true)).toBe(false);
		expect(keepsOpenEvent(true, true, undefined, true)).toBe(false);
		// The trigger the popup belongs to: as without the fourth fact.
		expect(keepsOpenEvent(true, true, "mouseenter", false)).toBe(true);
		expect(keepsOpenEvent(true, true, "click", false)).toBe(false);
	});
});

describe("namesOtherTrigger", () => {
	it("names another trigger only when the request has one and it isn't the active one", () => {
		expect(namesOtherTrigger("b", "a")).toBe(true);
		expect(namesOtherTrigger("b", null)).toBe(true);
		expect(namesOtherTrigger("a", "a")).toBe(false);
		expect(namesOtherTrigger(null, "a")).toBe(false);
		expect(namesOtherTrigger(null, null)).toBe(false);
	});
});

describe("movesToOtherTrigger", () => {
	it("moves to another trigger only from one trigger to a different one while open", () => {
		const a = { name: "a" };
		const b = { name: "b" };
		expect(movesToOtherTrigger(a, b, true)).toBe(true);
		expect(movesToOtherTrigger(a, b, false)).toBe(false);
		expect(movesToOtherTrigger(a, a, true)).toBe(false);
		// The first trigger, and a trigger going away, are no move.
		expect(movesToOtherTrigger(null, b, true)).toBe(false);
		expect(movesToOtherTrigger(a, null, true)).toBe(false);
	});
});

describe("pressOpenState", () => {
	it("opens on a press unless the owning trigger is pressed again", () => {
		expect(pressOpenState(false, true, undefined, true)).toBe(true);
		expect(pressOpenState(true, false, "click", true)).toBe(true);
		expect(pressOpenState(true, true, "click", true)).toBe(false);
		// A sticking hover open stays; a patient click closes it.
		expect(pressOpenState(true, true, "mouseenter", true)).toBe(true);
		expect(pressOpenState(true, true, "mouseenter", false)).toBe(false);
		expect(pressOpenState(true, true, undefined, true)).toBe(false);
	});
});

describe("visibleInstantType", () => {
	it("shows trigger-change only while open", () => {
		expect(visibleInstantType("trigger-change", true)).toBe("trigger-change");
		expect(visibleInstantType("trigger-change", false)).toBeUndefined();
		expect(visibleInstantType("dismiss", false)).toBe("dismiss");
	});
});

describe("awaitsUnmount", () => {
	it("waits for the exit animations only while closed, mounted and not kept", () => {
		expect(awaitsUnmount(false, true, false)).toBe(true);
		expect(awaitsUnmount(true, true, false)).toBe(false);
		expect(awaitsUnmount(false, false, false)).toBe(false);
		expect(awaitsUnmount(false, true, true)).toBe(false);
	});
});

describe("closesUnheard", () => {
	it("tells a close the session did not hear of", () => {
		expect(closesUnheard(false, true)).toBe(true);
		expect(closesUnheard(false, false)).toBe(false);
		expect(closesUnheard(true, true)).toBe(false);
		expect(closesUnheard(true, false)).toBe(false);
	});
});

describe("openValuesToFollow", () => {
	it("follows the open value once when it changed", () => {
		expect(openValuesToFollow(true, true, undefined)).toEqual([true]);
		expect(openValuesToFollow(false, false, undefined)).toEqual([false]);
		expect(openValuesToFollow(false, true, true)).toEqual([false]);
		expect(openValuesToFollow(true, false, false)).toEqual([true]);
	});

	it("follows nothing when only the heard value caught up with an open already followed", () => {
		expect(openValuesToFollow(true, true, true)).toEqual([]);
		expect(openValuesToFollow(false, false, false)).toEqual([]);
	});

	it("follows the change and the way back when a request and the app cancelled out", () => {
		// Closed by a request, then set back to open by the app: `open` is where it was, but the
		// session heard of the close.
		expect(openValuesToFollow(true, false, true)).toEqual([false, true]);
		expect(openValuesToFollow(false, true, false)).toEqual([true, false]);
	});
});
