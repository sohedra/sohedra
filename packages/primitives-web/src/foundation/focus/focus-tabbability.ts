// What makes a popup focusable: which element inside the positioned wrapper takes focus, and the
// popup's own tab stop.

import { focusable, isTabbable } from "../kernel/index.js";
import { FOCUSABLE_ATTRIBUTE, POPUP_TABINDEX_ATTRIBUTE } from "./focus-markers.js";

/** The element focus lives on: the popup (marked focusable) inside its positioned wrapper. */
export function getPopupFocusElement(
	positioner: HTMLElement | null | undefined,
): HTMLElement | null {
	if (!positioner) {
		return null;
	}
	return positioner.hasAttribute(FOCUSABLE_ATTRIBUTE)
		? positioner
		: positioner.querySelector<HTMLElement>(`[${FOCUSABLE_ATTRIBUTE}]`) || positioner;
}

/** A dialog without tabbable content must be tabbable itself; with content, it must not be. */
export function handleTabIndex(popupFocusElement: HTMLElement): void {
	if (
		popupFocusElement.hasAttribute("tabindex") &&
		!popupFocusElement.hasAttribute(POPUP_TABINDEX_ATTRIBUTE)
	) {
		return;
	}
	if (!popupFocusElement.getAttribute("role")?.includes("dialog")) {
		return;
	}
	const tabbableContent = focusable(popupFocusElement).filter((element) => {
		const dataTabIndex = element.getAttribute(POPUP_TABINDEX_ATTRIBUTE) || "";
		return (
			isTabbable(element) ||
			(element.hasAttribute(POPUP_TABINDEX_ATTRIBUTE) && !dataTabIndex.startsWith("-"))
		);
	});
	const tabIndex = popupFocusElement.getAttribute("tabindex");
	if (tabbableContent.length === 0) {
		if (tabIndex !== "0") {
			popupFocusElement.setAttribute("tabindex", "0");
			popupFocusElement.setAttribute(POPUP_TABINDEX_ATTRIBUTE, "0");
		}
	} else if (
		tabIndex !== "-1" ||
		(popupFocusElement.hasAttribute(POPUP_TABINDEX_ATTRIBUTE) &&
			popupFocusElement.getAttribute(POPUP_TABINDEX_ATTRIBUTE) !== "-1")
	) {
		popupFocusElement.setAttribute("tabindex", "-1");
		popupFocusElement.setAttribute(POPUP_TABINDEX_ATTRIBUTE, "-1");
	}
}
