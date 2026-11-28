// Where a press landed, relative to a popup: in its own elements, in a popup nested in it, or on
// something a press never dismisses for. Also the markers that tell a popup a press passed
// through a portal nested in it. The dismiss behaviour asks these; a popup's Portal part attaches
// the markers.

import { Timeout } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type {
	FloatingNode,
	FloatingTree,
} from "@sohedra/primitives-core/foundation/popup/index.js";
import type { Attachment } from "svelte/attachments";

import { INERT_MARKER } from "../focus/index.js";
import {
	contains,
	getComputedStyle,
	getParentNode,
	getTarget,
	isElement,
	isHTMLElement,
	isLastTraversableNode,
	isShadowRoot,
	ownerDocument,
	webScheduler,
	type WebTypes,
} from "../kernel/index.js";

/** The popup's place in the tree of nested popups. */
export interface TreePlaceView {
	readonly tree: FloatingTree<WebTypes> | null;
	readonly data: { readonly nodeId: string | undefined };
}

/**
 * What the press-target tests read from a popup. The names are a popup store's own, so a store
 * is handed over as it is.
 */
export interface PressTargetView extends TreePlaceView {
	/** The positioned element that holds the popup. */
	readonly floatingElement: Element | null;
	/** The element the popup is anchored to. */
	readonly anchorElement: Element | null;
	/** The popup's registered triggers. */
	readonly triggers: {
		hasElement(element: Element): boolean;
		hasMatchingElement(predicate: (element: Element) => boolean): boolean;
	};
}

function isEventTargetWithin(event: Event, node: Node | null | undefined) {
	if (node == null) {
		return false;
	}
	if ("composedPath" in event) {
		return event.composedPath().includes(node);
	}
	return (event as Event).target != null && node.contains((event as Event).target as Node);
}

function isRootElement(element: Element) {
	return element.matches("html,body");
}

// A press on a scrollbar doesn't dismiss (touch never presses scrollbars).
function isScrollbarPress(event: MouseEvent | PointerEvent | TouchEvent, target: HTMLElement) {
	if ("touches" in event) {
		return false;
	}
	const lastTraversable = isLastTraversableNode(target);
	const style = getComputedStyle(target);
	const scrollRe = /auto|scroll/;
	const isScrollableX = lastTraversable || scrollRe.test(style.overflowX);
	const isScrollableY = lastTraversable || scrollRe.test(style.overflowY);
	const canScrollX =
		isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth;
	const canScrollY =
		isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight;
	const isRtl = style.direction === "rtl";
	const pressedVertical =
		canScrollY &&
		(isRtl
			? event.offsetX <= target.offsetWidth - target.clientWidth
			: event.offsetX > target.clientWidth);
	const pressedHorizontal = canScrollX && event.offsetY > target.clientHeight;
	return pressedVertical || pressedHorizontal;
}

/**
 * Runs `listener` once `event` reaches its target (after the capture phase). An event that is
 * stopped on its way never arrives: the next event of its type that passes the target only ends
 * the wait, and `listener` isn't run for an event that is over.
 */
export function addTargetListenerOnce<E extends Event>(event: E, listener: (event: E) => void) {
	const target = getTarget(event);
	if (!target) {
		return;
	}
	const handle = (arrived: Event) => {
		target.removeEventListener(event.type, handle);
		if (arrived === event) {
			listener(event);
		}
	};
	target.addEventListener(event.type, handle);
}

/** Whether `event` passed through the popup or the element it is anchored to. */
export function isEventWithinOwnElements(
	popup: Pick<PressTargetView, "floatingElement" | "anchorElement">,
	event: Event,
): boolean {
	return (
		isEventTargetWithin(event, popup.floatingElement) ||
		isEventTargetWithin(event, popup.anchorElement)
	);
}

/** Whether `event` passed through the popup, its anchor, or a popup nested in it. */
export function isEventWithinFloatingTree(popup: PressTargetView, event: Event): boolean {
	const tree = popup.tree;
	const inChild =
		tree != null &&
		tree
			.children(popup.data.nodeId)
			.some((node) => isEventTargetWithin(event, node.context?.floatingElement));
	return isEventWithinOwnElements(popup, event) || inChild;
}

/**
 * Whether a press outside the popup still isn't one that dismisses: on another trigger, on a
 * third-party element injected after the popup opened, on a scrollbar, or in the popup tree.
 */
export function isSparedPressTarget(
	popup: PressTargetView,
	event: MouseEvent | PointerEvent | TouchEvent,
): boolean {
	const target = getTarget(event);
	const targetRoot = isElement(target) ? target.getRootNode() : null;
	const markers = Array.from(
		(isShadowRoot(targetRoot) ? targetRoot : ownerDocument(popup.floatingElement)).querySelectorAll(
			`[${INERT_MARKER}]`,
		),
	);

	// Pressing another trigger doesn't close the popup.
	const triggers = popup.triggers;
	if (
		isElement(target) &&
		(triggers.hasElement(target) ||
			triggers.hasMatchingElement((trigger) => contains(trigger, target)))
	) {
		return true;
	}

	let targetRootAncestor: Element | null = isElement(target) ? target : null;
	while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
		const nextParent = getParentNode(targetRootAncestor);
		if (isLastTraversableNode(nextParent) || !isElement(nextParent)) {
			break;
		}
		targetRootAncestor = nextParent;
	}

	// A press on a third-party element injected after the popup opened doesn't dismiss.
	if (
		markers.length &&
		isElement(target) &&
		!isRootElement(target) &&
		!contains(target, popup.floatingElement) &&
		markers.every((marker) => !contains(targetRootAncestor, marker))
	) {
		return true;
	}

	if (isHTMLElement(target) && isScrollbarPress(event, target)) {
		return true;
	}

	return isEventWithinFloatingTree(popup, event);
}

/** The events a press passes through, from its start to its click (and a touch's moves and end). */
export const PRESS_EVENTS = [
	"click",
	"mousedown",
	"pointerdown",
	"mouseup",
	"touchend",
	"touchmove",
] as const;

/** Marks `nodes` as pressed inside on every press passing through the element, until the next task. */
function attachInsideMarker(getNodes: () => FloatingNode<WebTypes>[]): Attachment<HTMLElement> {
	return (element) => {
		const clearTimeout = new Timeout(webScheduler);
		const mark = () => {
			const nodes = getNodes();
			for (const node of nodes) {
				if (node.context) {
					node.context.data.insideTree = true;
				}
			}
			clearTimeout.start(0, () => {
				for (const node of nodes) {
					if (node.context) {
						node.context.data.insideTree = false;
					}
				}
			});
		};
		for (const type of PRESS_EVENTS) {
			element.addEventListener(type, mark, true);
		}
		return () => {
			for (const type of PRESS_EVENTS) {
				element.removeEventListener(type, mark, true);
			}
			clearTimeout.clear();
		};
	};
}

/**
 * On a popup's Portal element: a press anywhere in the portal (the popup, but also a backdrop or a
 * viewport beside it) marks the popup's ancestors in the floating tree as pressed inside until the
 * next task, so a parent popup doesn't take it for an outside press. A portal moves the popup out
 * of its parent's element, so the parent can't see the press pass through itself. The popup
 * itself isn't marked: a press on its own backdrop still dismisses it.
 */
export function attachAncestorsInsideMarker(popup: TreePlaceView): Attachment<HTMLElement> {
	return attachInsideMarker(() => {
		const tree = popup.tree;
		return tree ? tree.ancestors(popup.data.nodeId) : [];
	});
}

/**
 * On the Portal element of a popup that isn't a node of the floating tree (a tooltip): a press in
 * it is inside the enclosing popup `parentId` and that popup's ancestors.
 */
export function attachEnclosingInsideMarker(
	tree: FloatingTree<WebTypes> | null,
	parentId: string | null,
): Attachment<HTMLElement> {
	return attachInsideMarker(() => {
		const parent = tree?.nodes.find((node) => node.id === parentId);
		return tree && parent ? [parent, ...tree.ancestors(parentId)] : [];
	});
}
