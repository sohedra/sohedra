// Where a press that began on a trigger ends: whether the pointer is still over the trigger, and
// which menu popup a node is in.

import { getParentNode, isLastTraversableNode, ownerWindow } from "../kernel/index.js";

// Tolerance for pointer drift during a press, so a fast click isn't read as a drag off.
const BOUNDARY_OFFSET = 5;

/** The element's box, grown to fit its `::before` and `::after` pseudo-elements. */
function getPseudoElementBounds(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	const win = ownerWindow(element);
	const before = win.getComputedStyle(element, "::before");
	const after = win.getComputedStyle(element, "::after");
	if (before.content === "none" && after.content === "none") {
		return rect;
	}
	const width = Math.max(rect.width, parseFloat(before.width) || 0, parseFloat(after.width) || 0);
	const height = Math.max(
		rect.height,
		parseFloat(before.height) || 0,
		parseFloat(after.height) || 0,
	);
	const widthDiff = width - rect.width;
	const heightDiff = height - rect.height;
	return {
		left: rect.left - widthDiff / 2,
		right: rect.right + widthDiff / 2,
		top: rect.top - heightDiff / 2,
		bottom: rect.bottom + heightDiff / 2,
	};
}

/** Whether a mouse event happened within the element (and its pseudo-elements), with drift. */
export function isMouseWithinBounds(event: MouseEvent, element: HTMLElement): boolean {
	const bounds = getPseudoElementBounds(element);
	return (
		event.clientX >= bounds.left - BOUNDARY_OFFSET &&
		event.clientX <= bounds.right + BOUNDARY_OFFSET &&
		event.clientY >= bounds.top - BOUNDARY_OFFSET &&
		event.clientY <= bounds.bottom + BOUNDARY_OFFSET
	);
}

/** The `data-rootownerid` of the menu popup `node` is in, if any. */
export function findRootOwnerId(node: Node): string | undefined {
	if (node instanceof HTMLElement && node.hasAttribute("data-rootownerid")) {
		return node.getAttribute("data-rootownerid") ?? undefined;
	}
	if (isLastTraversableNode(node)) {
		return undefined;
	}
	return findRootOwnerId(getParentNode(node));
}
