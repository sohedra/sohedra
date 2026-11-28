// The decisions every popup shares, as pure functions: facts in, outcome out. No state, no Svelte
// and no platform, so any thread can import them.

import { type InteractionEventType, REASONS } from "../kernel/index.js";
import type { InstantType } from "./popup-types.js";

/** Whether an event of this type is a press or a key. */
export function isClickLikeEventType(type: InteractionEventType | undefined): boolean {
	return type === "click" || type === "mousedown" || type === "keydown" || type === "keyup";
}

/**
 * The open state a trigger press asks for: opens a closed popup or one owned by another
 * trigger (`isActiveReference` false); on the owning trigger, closes it, unless
 * `stickIfOpen` and it was opened by something other than a press or a key (a hover).
 */
export function pressOpenState(
	open: boolean,
	isActiveReference: boolean,
	openEventType: InteractionEventType | undefined,
	stickIfOpen: boolean,
): boolean {
	if (!open || !isActiveReference) {
		return true;
	}
	if (openEventType !== undefined && stickIfOpen) {
		return !isClickLikeEventType(openEventType);
	}
	return false;
}

/**
 * Whether an open request names a trigger other than the one the popup belongs to. A request
 * without a trigger names none.
 */
export function namesOtherTrigger(requestedId: string | null, activeId: string | null): boolean {
	return requestedId !== null && requestedId !== activeId;
}

/**
 * Whether the popup moved to another trigger: the active trigger changed from one element to
 * another while the popup is open. `previous` is the last trigger it was anchored to, kept while
 * it had none.
 */
export function movesToOtherTrigger(
	previous: object | null,
	current: object | null,
	open: boolean,
): boolean {
	return previous !== null && current !== null && current !== previous && open;
}

/**
 * Whether an accepted change leaves the recorded open event as it is: only an opening of an
 * open popup by something other than a press or a key, from the trigger it belongs to.
 * So a pending hover open doesn't replace a click-like open event, a click-like event upgrades a
 * hover open, and a close forgets the event. A hover that moves the popup to another trigger
 * (`triggerChanged`) is a new opening: the press on the trigger it left no longer counts.
 */
export function keepsOpenEvent(
	next: boolean,
	wasOpen: boolean,
	eventType: InteractionEventType | undefined,
	triggerChanged = false,
): boolean {
	return next && wasOpen && !triggerChanged && !isClickLikeEventType(eventType);
}

/**
 * The instant type an accepted open change implies for a popup its triggers open by hovering or
 * focusing them: `focus` for a focus opening, `dismiss` for a close by a trigger press or
 * Escape, none for a hover change, else `current`.
 */
export function hoverOpenInstantType(
	open: boolean,
	reason: string | null,
	current: InstantType,
): InstantType {
	if (open && reason === REASONS.triggerFocus) {
		return "focus";
	}
	if (!open && (reason === REASONS.triggerPress || reason === REASONS.escapeKey)) {
		return "dismiss";
	}
	return reason === REASONS.triggerHover ? undefined : current;
}

/**
 * Whether the popup is in an opening its session has not heard of yet: open now, closed when the
 * session last heard of it (`heardOpen`). Such an opening starts with no instant type: what is
 * stored belongs to an earlier opening or to the close before it.
 */
export function opensUnheard(open: boolean, heardOpen: boolean): boolean {
	return open && !heardOpen;
}

/**
 * Whether the popup closed without its session hearing of it: closed now, open when the session
 * last heard (`heardOpen`). Such a close came from outside (a bound `open`), so no open-change
 * event told the popup's interactions.
 */
export function closesUnheard(open: boolean, heardOpen: boolean): boolean {
	return !open && heardOpen;
}

/**
 * The open values a lifecycle's watch still has to follow, in order. `followed` is the value it
 * followed last (`undefined` before its first run), `heardOpen` what the session last heard.
 * Normally that is `open`, once. Nothing when only `heardOpen` caught up with an `open` already
 * followed. And when a request and the app cancelled each other out in one update (a requested
 * close, then `open` set back to true from outside before effects ran), `open` is where it was but
 * the session heard of the change: that one is followed first, then the one back, as if the two
 * had come in separate updates.
 */
export function openValuesToFollow(
	open: boolean,
	heardOpen: boolean,
	followed: boolean | undefined,
): readonly boolean[] {
	if (open !== followed) {
		return [open];
	}
	return heardOpen === open ? [] : [heardOpen, open];
}

/**
 * The instant type the parts render from the stored one: none in an opening the session has not
 * heard of yet (a bound `open` set from outside, until the lifecycle hears of it), and
 * `trigger-change` only means something while open, so a closing popup never reports it.
 */
export function visibleInstantType(
	stored: InstantType,
	open: boolean,
	heardOpen: boolean = open,
): InstantType {
	if (opensUnheard(open, heardOpen)) {
		return undefined;
	}
	return stored === "trigger-change" && !open ? undefined : stored;
}

/**
 * Whether a closed popup is waiting for its exit animations before unmounting: closed, still
 * mounted, and not kept by `preventUnmountOnClose()`.
 */
export function awaitsUnmount(open: boolean, mounted: boolean, preventUnmount: boolean): boolean {
	return !open && mounted && !preventUnmount;
}

/**
 * Whether a popup is nested in another floating element (its stores' `nested`), from the id of
 * its nearest floating-tree node and the dialog it is rendered in. A dialog is a node of the tree
 * but not a floating element: a popup directly under a dialog's node is nested only when that
 * dialog is.
 */
export function isNestedInFloating(
	parentNodeId: string | null,
	dialog: { readonly nodeId: string | undefined; readonly nested: boolean } | null,
): boolean {
	if (parentNodeId == null) {
		return false;
	}
	return dialog != null && parentNodeId === dialog.nodeId ? dialog.nested : true;
}
