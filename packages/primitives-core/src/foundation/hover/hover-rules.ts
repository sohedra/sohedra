// The decisions of the hover behaviour, as pure functions: facts or a popup's view in, outcome
// out. No effects, no Svelte and no platform.

import type { InteractionEventType, PlatformTypes, PointerType } from "../kernel/index.js";
import type { HoverTreeView, HoverView } from "./hover-types.js";

/** A hover delay: one value, or separate open and close delays. */
export type HoverDelay = number | Partial<{ open: number; close: number }>;

/** What a trigger's hover timing is made of: the three fields of `HoverTriggerOptions` it fills. */
export interface HoverTiming {
	readonly mouseOnly: boolean;
	readonly restMs: number;
	readonly delay: HoverDelay | undefined;
}

/**
 * A trigger's hover timing from its behaviour row's `hover` entry: a `rest` row opens once the
 * pointer has rested for `open` ms, an `enter` row opens `open` ms after the pointer enters.
 * Both close after `close` ms.
 */
export function getHoverTiming(
	hover: { readonly mouseOnly: boolean; readonly delay: "rest" | "enter" },
	open: number | undefined,
	close: number | undefined,
): HoverTiming {
	const { mouseOnly } = hover;
	if (hover.delay === "rest") {
		return { mouseOnly, restMs: open ?? 0, delay: { close } };
	}
	return { mouseOnly, restMs: 0, delay: { open, close } };
}

/** Mouse or pen (some Linux Chromium mice report `pen`); loosely, also an unknown type. */
export function isMouseLikePointerType(
	pointerType: PointerType | undefined,
	strict?: boolean,
): boolean {
	const values: (PointerType | undefined)[] = ["mouse", "pen"];
	if (!strict) {
		values.push("", undefined);
	}
	return values.includes(pointerType);
}

/** The open or close delay for `pointerType`: touch input never waits. */
export function getDelay(
	value: HoverDelay | (() => HoverDelay) | undefined,
	prop: "open" | "close",
	pointerType?: PointerType,
): number | undefined {
	if (pointerType != null && !isMouseLikePointerType(pointerType)) {
		return 0;
	}
	const resolved = typeof value === "function" ? value() : value;
	return typeof resolved === "number" ? resolved : resolved?.[prop];
}

/** Whether the popup was opened by a click (or a press inside it), which hover never closes. */
export function isClickLikeOpenEvent(
	openEventType: InteractionEventType | undefined,
	interactedInside: boolean,
): boolean {
	return interactedInside || openEventType === "click" || openEventType === "mousedown";
}

/**
 * Whether a click holds the popup open, so that a hover neither closes it nor opens it again:
 * only while it is open. The recorded open event outlives a close the app makes itself, and a
 * closed popup is not held by the click that opened it earlier.
 */
export function isPinnedByClick(
	open: boolean,
	openEventType: InteractionEventType | undefined,
	interactedInside: boolean,
): boolean {
	return open && isClickLikeOpenEvent(openEventType, interactedInside);
}

/** Whether the popup was opened by hovering: the pointer entering or moving over a trigger. */
export function isHoverOpenEvent(openEventType: InteractionEventType | undefined): boolean {
	return openEventType === "mouseenter" || openEventType === "mousemove";
}

/** Whether a pointer move travelled far enough (at least √2px) to restart a pending rest. */
export function hasMovedEnough(movementX: number, movementY: number): boolean {
	return movementX ** 2 + movementY ** 2 >= 2;
}

/**
 * Whether a pointer entering a trigger opens the popup at once, skipping the delays: it moved
 * to another trigger of an open popup (or of one a hover is closing), or it came back onto the
 * owning trigger while a hover close is still running.
 */
export function opensAtOnceOnEnter(
	open: boolean,
	closingAfterHover: boolean,
	overInactiveTrigger: boolean,
	withinAnchor: boolean,
): boolean {
	if (overInactiveTrigger) {
		return open || closingAfterHover;
	}
	return withinAnchor && closingAfterHover;
}

/** Whether a popup nested in this one is open. */
export function hasOpenChild<T extends PlatformTypes>(popup: HoverTreeView<T>): boolean {
	const tree = popup.tree;
	return Boolean(tree && tree.children(popup.nodeId).length > 0);
}

/** Whether a click holds the open popup open, which a hover never closes or reopens. */
export function isPinned<T extends PlatformTypes>(popup: HoverView<T>): boolean {
	return isPinnedByClick(popup.open, popup.openEventType, popup.hover.interactedInside);
}
