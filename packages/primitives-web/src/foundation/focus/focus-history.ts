// The elements that had focus before popups opened, newest last: where a popup returns focus when
// its trigger and the element focused before it are gone or hidden. One list per page, in module
// state: focus is one per document.

import { getNodeName, isElementVisible } from "../kernel/index.js";

const LIST_LIMIT = 20;
let previouslyFocusedElements: WeakRef<Element>[] = [];

/** Forgets focus history entries whose elements left the document. */
export function clearDisconnectedPreviouslyFocusedElements(): void {
	previouslyFocusedElements = previouslyFocusedElements.filter(
		(entry) => entry.deref()?.isConnected,
	);
}

/** Remembers `element` (not the body) as focused before a popup opened. */
export function addPreviouslyFocusedElement(element: Element | null | undefined): void {
	clearDisconnectedPreviouslyFocusedElements();
	if (element && getNodeName(element) !== "body") {
		previouslyFocusedElements.push(new WeakRef(element));
		if (previouslyFocusedElements.length > LIST_LIMIT) {
			previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
		}
	}
}

/** The most recent element focused before a popup opened, if still in the document. */
export function getPreviouslyFocusedElement(): Element | undefined {
	clearDisconnectedPreviouslyFocusedElements();
	return previouslyFocusedElements[previouslyFocusedElements.length - 1]?.deref();
}

/**
 * Whether `element` can take focus now: it is shown, and not in content that an open popup or
 * the app has made inert or hidden from assistive technology.
 */
function canTakeFocus(element: Element): boolean {
	return isElementVisible(element) && !element.closest('[inert], [aria-hidden="true"]');
}

/**
 * The newest element focused before a popup opened that can take focus now: where focus returns
 * when the usual target is in the document but hidden, as a control of a closed popup that stays
 * mounted is.
 */
export function getFocusablePreviouslyFocusedElement(): Element | undefined {
	clearDisconnectedPreviouslyFocusedElements();
	for (let index = previouslyFocusedElements.length - 1; index >= 0; index -= 1) {
		const element = previouslyFocusedElements[index].deref();
		if (element && canTakeFocus(element)) {
			return element;
		}
	}
	return undefined;
}
