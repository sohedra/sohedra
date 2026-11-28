// The decisions of dismissing a popup with Escape or a press outside it, as plain functions: the
// press type per pointer, which event of a press dismisses, what a touch that moves does, what
// the end of a press that began inside means, and which popup of a nested set answers.

import type { InteractionEventType, PlatformTypes, PointerType } from "../kernel/index.js";
import type { FloatingTree } from "../popup/index.js";

/**
 * How an outside press is detected: `intentional` dismisses on an outside `click` whose press
 * began while open; `sloppy` dismisses on the press's start (mouse) or when a touch ends or
 * scrolls away.
 */
export type PressType = "intentional" | "sloppy";

/** The press type, the same for every pointer or one per kind of pointer, fixed or asked each time. */
export type OutsidePressEvent =
	| PressType
	| { mouse: PressType; touch: PressType }
	| (() => PressType | { mouse: PressType; touch: PressType });

/** The press type for the current pointer type (pen and unknown count as mouse). */
export function resolvePressType(
	pointerType: PointerType,
	outsidePressEvent: OutsidePressEvent,
): PressType {
	const type = pointerType === "touch" ? "touch" : "mouse";
	const resolved =
		typeof outsidePressEvent === "function" ? outsidePressEvent() : outsidePressEvent;
	return typeof resolved === "string" ? resolved : resolved[type];
}

/**
 * Whether an outside press of `eventType` (core's vocabulary: `click` for the press's end,
 * anything else for its start or a touch) is not the one `pressType` dismisses on.
 */
export function isIgnoredOutsidePress(
	eventType: InteractionEventType | undefined,
	pressType: PressType,
): boolean {
	return (
		(pressType === "intentional" && eventType !== "click") ||
		(pressType === "sloppy" && eventType === "click")
	);
}

/**
 * Whether an open child of node `nodeId` keeps this dismissal from happening: it doesn't let the
 * dismissal bubble to its ancestors.
 */
export function hasBlockingChild<T extends PlatformTypes>(
	tree: FloatingTree<T> | null,
	nodeId: string | undefined,
	kind: "escapeKey" | "outsidePress",
): boolean {
	const children = tree ? tree.children(nodeId) : [];
	return children.some((child) => child.context?.open && !child.context.dismissBubbles[kind]);
}

/**
 * Whether an outside click is only the tail of a press that began before the popup opened: it
 * reports a press behind it, but none was seen while open. A click with no press behind it (the
 * keyboard, assistive technology) is always a press of its own.
 */
export function isTrailingClick(pressBacked: boolean, sawPressWhileOpen: boolean): boolean {
	return pressBacked && !sawPressWhileOpen;
}

/** How long a touch may last and still dismiss when it ends or on its compatibility press. */
export const LONG_TOUCH_MS = 1000;
/** How far a touch moves before its end dismisses. */
export const TOUCH_END_DISTANCE = 5;
/** How far a touch moves before it dismisses at once: the user is scrolling away. */
export const TOUCH_MOVE_DISTANCE = 10;

/** What a moving touch outside the popup does, by how far it is from where it started. */
export function touchMoveOutcome(
	startX: number,
	startY: number,
	x: number,
	y: number,
): "none" | "dismiss-on-end" | "dismiss" {
	const deltaX = Math.abs(x - startX);
	const deltaY = Math.abs(y - startY);
	const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	if (distance > TOUCH_MOVE_DISTANCE) {
		return "dismiss";
	}
	return distance > TOUCH_END_DISTANCE ? "dismiss-on-end" : "none";
}

/** What the end of a press that began inside the popup asks for. */
export interface PressEnd {
	readonly pressType: PressType;
	/** Whether the gesture was cancelled: it makes no click. */
	readonly canceled: boolean;
	/** Whether the press's start had its default prevented (a drag handle). */
	readonly startPrevented: boolean;
	/** Whether the press ended in the popup, its anchor or a popup nested in it. */
	readonly endedInTree: boolean;
}

/**
 * What the end of a press that began inside the popup means for the click after it, which lands
 * on the common ancestor of both ends and so looks like an outside click:
 * - `suppress-next`: the press was dragged out, so the next outside click doesn't dismiss;
 * - `suppress-immediate`: its start was prevented, so it may make no click at all; only a click
 *   that arrives at once is absorbed.
 */
export function pressEndOutcome(end: PressEnd): "none" | "suppress-immediate" | "suppress-next" {
	if (end.pressType !== "intentional") {
		return "none";
	}
	if (end.canceled) {
		return end.startPrevented ? "suppress-immediate" : "none";
	}
	if (end.endedInTree) {
		return "none";
	}
	// A prevented press start may make no click, but a browser can still emit one: absorb it.
	return end.startPrevented ? "suppress-immediate" : "suppress-next";
}
