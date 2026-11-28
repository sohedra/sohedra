// Popover's own decisions, as pure functions: facts in, outcome out.

import type { PressType } from "../../foundation/dismiss/index.js";
import { REASONS } from "../../foundation/kernel/index.js";
import {
	type InstantType,
	type InteractionType,
	POPUP_BEHAVIOR,
} from "../../foundation/popup/index.js";

/** A click this soon after a hover-open keeps it open. */
export const PATIENT_CLICK_THRESHOLD = 500;

/** How long the pointer rests on a trigger before a hover opens it. */
export const OPEN_DELAY = 300;

/**
 * Why an accepted open change skips transitions: a trigger press without a pointer (Enter or
 * Space), a dismissal (Escape, or a close without a reason), or focus leaving the popover.
 */
export function popoverInstantType(
	next: boolean,
	reason: string | null | undefined,
	keyboardClick: boolean,
): InstantType {
	if (reason === REASONS.triggerPress && keyboardClick) {
		return "click";
	}
	if (!next && (reason === REASONS.escapeKey || reason == null)) {
		return "dismiss";
	}
	return reason === REASONS.focusOut ? "focus" : undefined;
}

/**
 * Whether a close takes the active trigger as its `trigger`: a Close part's press that carried
 * none, while a trigger owns the popover.
 */
export function closeTakesActiveTrigger(
	next: boolean,
	reason: string | null | undefined,
	hasTrigger: boolean,
	activeTriggerId: string | null,
): boolean {
	return !next && reason === REASONS.closePress && !hasTrigger && activeTriggerId != null;
}

/** Whether a hover-enabled popover was opened by a touch press. */
export function isTouchPressOpen(
	openOnHover: boolean,
	openMethod: InteractionType | null,
	reason: string | null,
): boolean {
	return openOnHover && openMethod === "touch" && reason === REASONS.triggerPress;
}

/**
 * Whether a trigger renders the focus guards that carry Tab into its popup and out of it: the
 * trigger that opened a popover which doesn't trap focus, unless a hover opened it. A
 * hover-opened popover takes no focus, so its popup has no guard for the trigger's to hand focus
 * to, and Tab follows the document's own order.
 */
export function triggerHasFocusGuards(
	openedByTrigger: boolean,
	trapsFocus: boolean,
	reason: string | null,
): boolean {
	return openedByTrigger && !trapsFocus && reason !== REASONS.triggerHover;
}

/**
 * How an outside press dismisses the popover. One that traps focus dismisses on the press itself
 * (`sloppy`) for a mouse too, so the `aria-hidden` on outside elements is removed at once.
 */
export function popoverOutsidePress(modal: boolean | "trap-focus"): {
	mouse: PressType;
	touch: PressType;
} {
	const { mouse, touch } = POPUP_BEHAVIOR.popover.outsidePress;
	return { mouse: modal === "trap-focus" ? "sloppy" : mouse, touch };
}
