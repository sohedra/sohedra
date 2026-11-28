// What makes a popup focusable: which element inside the positioned wrapper takes focus, and the
// popup's own tab stop.

import { focusable, isTabbable } from "../kernel/index.js";
import { FOCUSABLE_ATTRIBUTE } from "./focus-markers.js";

/** The element focus lives on: the popup (marked focusable) inside its positioned wrapper. */
export function getFloatingFocusElement(
	floating: HTMLElement | null | undefined,
): HTMLElement | null {
	if (!floating) {
		return null;
	}
	return floating.hasAttribute(FOCUSABLE_ATTRIBUTE)
		? floating
		: floating.querySelector<HTMLElement>(`[${FOCUSABLE_ATTRIBUTE}]`) || floating;
}

/** A dialog without tabbable content must be tabbable itself; with content, it must not be. */
export function handleTabIndex(floatingFocusElement: HTMLElement): void {
	if (
		floatingFocusElement.hasAttribute("tabindex") &&
		!floatingFocusElement.hasAttribute("data-tabindex")
	) {
		return;
	}
	if (!floatingFocusElement.getAttribute("role")?.includes("dialog")) {
		return;
	}
	const tabbableContent = focusable(floatingFocusElement).filter((element) => {
		const dataTabIndex = element.getAttribute("data-tabindex") || "";
		return (
			isTabbable(element) ||
			(element.hasAttribute("data-tabindex") && !dataTabIndex.startsWith("-"))
		);
	});
	const tabIndex = floatingFocusElement.getAttribute("tabindex");
	if (tabbableContent.length === 0) {
		if (tabIndex !== "0") {
			floatingFocusElement.setAttribute("tabindex", "0");
			floatingFocusElement.setAttribute("data-tabindex", "0");
		}
	} else if (
		tabIndex !== "-1" ||
		(floatingFocusElement.hasAttribute("data-tabindex") &&
			floatingFocusElement.getAttribute("data-tabindex") !== "-1")
	) {
		floatingFocusElement.setAttribute("tabindex", "-1");
		floatingFocusElement.setAttribute("data-tabindex", "-1");
	}
}
