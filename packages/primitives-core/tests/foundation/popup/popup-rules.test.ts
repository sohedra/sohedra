// The pure decisions of the popup pipeline and of Popover, each as facts in and an outcome out.
// `pressOpenState` and `hoverOpenInstantType` also run in the decisions test.

import { describe, expect, it } from "vitest";

import {
	closeTakesActiveTrigger,
	isTouchPressOpen,
	popoverInstantType,
	popoverOutsidePress,
} from "../../../src/components/popover/index.js";
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

describe("popup rules", () => {
	it("takes presses and keys as click-like", () => {
		expect(isClickLikeEventType("click")).toBe(true);
		expect(isClickLikeEventType("mousedown")).toBe(true);
		expect(isClickLikeEventType("keydown")).toBe(true);
		expect(isClickLikeEventType("keyup")).toBe(true);
		expect(isClickLikeEventType("mouseenter")).toBe(false);
		expect(isClickLikeEventType(REASONS.imperativeAction)).toBe(false);
		expect(isClickLikeEventType(undefined)).toBe(false);
	});

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

	it("names another trigger only when the request has one and it isn't the active one", () => {
		expect(namesOtherTrigger("b", "a")).toBe(true);
		expect(namesOtherTrigger("b", null)).toBe(true);
		expect(namesOtherTrigger("a", "a")).toBe(false);
		expect(namesOtherTrigger(null, "a")).toBe(false);
		expect(namesOtherTrigger(null, null)).toBe(false);
	});

	it("opens on a press unless the owning trigger is pressed again", () => {
		expect(pressOpenState(false, true, undefined, true)).toBe(true);
		expect(pressOpenState(true, false, "click", true)).toBe(true);
		expect(pressOpenState(true, true, "click", true)).toBe(false);
		// A sticking hover open stays; a patient click closes it.
		expect(pressOpenState(true, true, "mouseenter", true)).toBe(true);
		expect(pressOpenState(true, true, "mouseenter", false)).toBe(false);
		expect(pressOpenState(true, true, undefined, true)).toBe(false);
	});

	it("shows trigger-change only while open", () => {
		expect(visibleInstantType("trigger-change", true)).toBe("trigger-change");
		expect(visibleInstantType("trigger-change", false)).toBeUndefined();
		expect(visibleInstantType("dismiss", false)).toBe("dismiss");
	});

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

	it("waits for the exit animations only while closed, mounted and not kept", () => {
		expect(awaitsUnmount(false, true, false)).toBe(true);
		expect(awaitsUnmount(true, true, false)).toBe(false);
		expect(awaitsUnmount(false, false, false)).toBe(false);
		expect(awaitsUnmount(false, true, true)).toBe(false);
	});
});

describe("popover rules", () => {
	it("skips transitions for a keyboard press, a dismissal and a focus-out", () => {
		expect(popoverInstantType(true, REASONS.triggerPress, true)).toBe("click");
		expect(popoverInstantType(true, REASONS.triggerPress, false)).toBeUndefined();
		expect(popoverInstantType(false, REASONS.escapeKey, false)).toBe("dismiss");
		expect(popoverInstantType(false, undefined, false)).toBe("dismiss");
		expect(popoverInstantType(true, REASONS.escapeKey, false)).toBeUndefined();
		expect(popoverInstantType(false, REASONS.focusOut, false)).toBe("focus");
		expect(popoverInstantType(false, REASONS.outsidePress, false)).toBeUndefined();
	});

	it("gives a close press the active trigger only when it carried none", () => {
		expect(closeTakesActiveTrigger(false, REASONS.closePress, false, "t")).toBe(true);
		expect(closeTakesActiveTrigger(false, REASONS.closePress, true, "t")).toBe(false);
		expect(closeTakesActiveTrigger(false, REASONS.closePress, false, null)).toBe(false);
		expect(closeTakesActiveTrigger(false, REASONS.escapeKey, false, "t")).toBe(false);
		expect(closeTakesActiveTrigger(true, REASONS.closePress, false, "t")).toBe(false);
	});

	it("tells a touch press on a hover-enabled trigger", () => {
		expect(isTouchPressOpen(true, "touch", REASONS.triggerPress)).toBe(true);
		expect(isTouchPressOpen(false, "touch", REASONS.triggerPress)).toBe(false);
		expect(isTouchPressOpen(true, "mouse", REASONS.triggerPress)).toBe(false);
		expect(isTouchPressOpen(true, "touch", REASONS.triggerHover)).toBe(false);
	});

	it("reads the outside press from the behaviour row, sloppy for a mouse while trapping focus", () => {
		expect(popoverOutsidePress(false)).toEqual({ mouse: "intentional", touch: "sloppy" });
		expect(popoverOutsidePress(true)).toEqual({ mouse: "intentional", touch: "sloppy" });
		expect(popoverOutsidePress("trap-focus")).toEqual({ mouse: "sloppy", touch: "sloppy" });
	});
});

describe("closes from outside", () => {
	it("tells a close the session did not hear of", () => {
		expect(closesUnheard(false, true)).toBe(true);
		expect(closesUnheard(false, false)).toBe(false);
		expect(closesUnheard(true, true)).toBe(false);
		expect(closesUnheard(true, false)).toBe(false);
	});

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
