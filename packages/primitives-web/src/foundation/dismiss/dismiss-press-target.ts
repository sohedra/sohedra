// Where a press landed, relative to a popup: in its own elements, in a popup nested in it, or on
// something a press never dismisses for. The dismiss behaviour asks these.

import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";

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
	type WebTypes,
} from "../kernel/index.js";

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

/** Whether `event` passed through the popup or the element it is anchored to. */
export function isEventWithinOwnElements(
	popup: Pick<PopupView<WebTypes>, "positionerElement" | "anchorElement">,
	event: Event,
): boolean {
	return (
		isEventTargetWithin(event, popup.positionerElement) ||
		isEventTargetWithin(event, popup.anchorElement)
	);
}

/** Whether `event` passed through the popup, its anchor, or a popup nested in it. */
export function isEventWithinPopupTree(popup: PopupView<WebTypes>, event: Event): boolean {
	const tree = popup.tree;
	const inChild =
		tree != null &&
		tree
			.children(popup.nodeId)
			.some((node) => isEventTargetWithin(event, node.context?.positionerElement));
	return isEventWithinOwnElements(popup, event) || inChild;
}

/**
 * Whether a press outside the popup still isn't one that dismisses: on another trigger, on a
 * third-party element injected after the popup opened, on a scrollbar, or in the popup tree.
 */
export function isSparedPressTarget(
	popup: PopupView<WebTypes>,
	event: MouseEvent | PointerEvent | TouchEvent,
): boolean {
	const target = getTarget(event);
	const targetRoot = isElement(target) ? target.getRootNode() : null;
	const markers = Array.from(
		(isShadowRoot(targetRoot)
			? targetRoot
			: ownerDocument(popup.positionerElement)
		).querySelectorAll(`[${INERT_MARKER}]`),
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
		!contains(target, popup.positionerElement) &&
		markers.every((marker) => !contains(targetRootAncestor, marker))
	) {
		return true;
	}

	if (isHTMLElement(target) && isScrollbarPress(event, target)) {
		return true;
	}

	return isEventWithinPopupTree(popup, event);
}
