// The data attributes a popup's focus, portal, dismiss and trigger wiring find elements by.
/** Marks the element a focus manager focuses inside a positioned wrapper. */
export const FOCUSABLE_ATTRIBUTE = "data-sohedra-focusable";
/** Marks a portal node. */
export const PORTAL_ATTRIBUTE = "data-sohedra-portal";
/** Marks a trigger that opens its popup on click. */
export const CLICK_TRIGGER_IDENTIFIER = "data-sohedra-click-trigger";
/** The marker on elements outside an open popup: outside presses on later-injected nodes pass. */
export const INERT_MARKER = "data-sohedra-inert";

/** Props that make the popup element focusable by the focus manager, but not by Tab. */
export const FOCUSABLE_POPUP_PROPS = { tabindex: -1, [FOCUSABLE_ATTRIBUTE]: "" };
