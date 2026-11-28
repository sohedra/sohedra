// Popover's rules as facts in and an outcome out: the instant type of a change, the trigger a close
// press takes, a touch press, the outside press per modal mode, and the trigger focus guards.
import { describe, expect, it } from "vitest";

import {
	closeTakesActiveTrigger,
	isTouchPressOpen,
	popoverInstantType,
	popoverOutsidePress,
	triggerHasFocusGuards,
} from "../../../src/components/popover/index.js";
import { REASONS } from "../../../src/foundation/kernel/index.js";

describe("popoverInstantType", () => {
	it("skips transitions for a keyboard press, a dismissal and a focus-out", () => {
		expect(popoverInstantType(true, REASONS.triggerPress, true)).toBe("click");
		expect(popoverInstantType(true, REASONS.triggerPress, false)).toBeUndefined();
		expect(popoverInstantType(false, REASONS.escapeKey, false)).toBe("dismiss");
		expect(popoverInstantType(false, undefined, false)).toBe("dismiss");
		expect(popoverInstantType(true, REASONS.escapeKey, false)).toBeUndefined();
		expect(popoverInstantType(false, REASONS.focusOut, false)).toBe("focus");
		expect(popoverInstantType(false, REASONS.outsidePress, false)).toBeUndefined();
	});
});

describe("closeTakesActiveTrigger", () => {
	it("gives a close press the active trigger only when it carried none", () => {
		expect(closeTakesActiveTrigger(false, REASONS.closePress, false, "t")).toBe(true);
		expect(closeTakesActiveTrigger(false, REASONS.closePress, true, "t")).toBe(false);
		expect(closeTakesActiveTrigger(false, REASONS.closePress, false, null)).toBe(false);
		expect(closeTakesActiveTrigger(false, REASONS.escapeKey, false, "t")).toBe(false);
		expect(closeTakesActiveTrigger(true, REASONS.closePress, false, "t")).toBe(false);
	});
});

describe("isTouchPressOpen", () => {
	it("tells a touch press on a hover-enabled trigger", () => {
		expect(isTouchPressOpen(true, "touch", REASONS.triggerPress)).toBe(true);
		expect(isTouchPressOpen(false, "touch", REASONS.triggerPress)).toBe(false);
		expect(isTouchPressOpen(true, "mouse", REASONS.triggerPress)).toBe(false);
		expect(isTouchPressOpen(true, "touch", REASONS.triggerHover)).toBe(false);
	});
});

describe("popoverOutsidePress", () => {
	it("reads the outside press from the behaviour row, sloppy for a mouse while trapping focus", () => {
		expect(popoverOutsidePress(false)).toEqual({ mouse: "intentional", touch: "sloppy" });
		expect(popoverOutsidePress(true)).toEqual({ mouse: "intentional", touch: "sloppy" });
		expect(popoverOutsidePress("trap-focus")).toEqual({ mouse: "sloppy", touch: "sloppy" });
	});
});

// A popover a hover opened takes no focus, so its popup has no guard to receive it and the trigger
// renders none either; a press on the trigger turns them on again.
describe("triggerHasFocusGuards", () => {
	it("gives guards to the trigger that opened a popover without a focus trap", () => {
		expect(triggerHasFocusGuards(true, false, REASONS.triggerPress)).toBe(true);
		expect(triggerHasFocusGuards(true, false, REASONS.none)).toBe(true);
		expect(triggerHasFocusGuards(true, false, null)).toBe(true);
	});

	it("gives none to a trigger that didn't open the popover, or when the popup traps focus", () => {
		expect(triggerHasFocusGuards(false, false, REASONS.triggerPress)).toBe(false);
		expect(triggerHasFocusGuards(true, true, REASONS.triggerPress)).toBe(false);
	});

	it("gives none while a hover holds the popover open", () => {
		expect(triggerHasFocusGuards(true, false, REASONS.triggerHover)).toBe(false);
	});
});
