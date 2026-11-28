// Popover's styling hooks on the web: the data attributes and CSS variables its parts render, and
// how state maps to the attributes.

import type { StateAttributesMapping } from "../../foundation/kernel/index.js";
import {
	popupStateMapping,
	popupTransitionStateMapping,
	popupViewportStateMapping,
} from "../../foundation/popup/index.js";
import type {
	PopoverArrowState,
	PopoverBackdropState,
	PopoverPopupState,
	PopoverPositionerState,
	PopoverTriggerState,
	PopoverViewportState,
} from "./popover-types.js";

/** The data attributes Popover.Trigger renders. */
export const PopoverTriggerDataAttributes = {
	/** Present when the corresponding popover is open. */
	popupOpen: "data-popup-open",
	/** Present when the trigger is pressed. */
	pressed: "data-pressed",
	/** Present when the trigger is disabled. */
	disabled: "data-disabled",
} as const;

/** The CSS variables Popover.Positioner sets. */
export const PopoverPositionerCssVariables = {
	/** The available width between the trigger and the edge of the viewport. */
	availableWidth: "--available-width",
	/** The available height between the trigger and the edge of the viewport. */
	availableHeight: "--available-height",
	/** The anchor's width. */
	anchorWidth: "--anchor-width",
	/** The anchor's height. */
	anchorHeight: "--anchor-height",
	/** The coordinates that this element is anchored to. Used for animations and transitions. */
	transformOrigin: "--transform-origin",
	/** The width of the popover's positioner. */
	positionerWidth: "--positioner-width",
	/** The height of the popover's positioner. */
	positionerHeight: "--positioner-height",
} as const;

/** The data attributes Popover.Positioner renders. */
export const PopoverPositionerDataAttributes = {
	/** Present when the popup is open. */
	open: "data-open",
	/** Present when the popup is closed. */
	closed: "data-closed",
	/** Present when the anchor is hidden. */
	anchorHidden: "data-anchor-hidden",
	/** Which side the popup is positioned relative to the trigger. */
	side: "data-side",
	/** How the popup is aligned relative to the specified side. */
	align: "data-align",
} as const;

/** The CSS variables Popover.Popup sets. */
export const PopoverPopupCssVariables = {
	/** The width of the popup. */
	popupWidth: "--popup-width",
	/** The height of the popup. */
	popupHeight: "--popup-height",
} as const;

/** The data attributes Popover.Popup renders. */
export const PopoverPopupDataAttributes = {
	open: "data-open",
	closed: "data-closed",
	startingStyle: "data-starting-style",
	endingStyle: "data-ending-style",
	side: "data-side",
	align: "data-align",
	/** Present if animations should be instant. */
	instant: "data-instant",
} as const;

/** The data attributes Popover.Arrow renders. */
export const PopoverArrowDataAttributes = {
	open: "data-open",
	closed: "data-closed",
	side: "data-side",
	align: "data-align",
	/** Present when the popover arrow is uncentered. */
	uncentered: "data-uncentered",
} as const;

/** The data attributes Popover.Backdrop renders. */
export const PopoverBackdropDataAttributes = {
	open: "data-open",
	closed: "data-closed",
	startingStyle: "data-starting-style",
	endingStyle: "data-ending-style",
} as const;

/** The CSS variables Popover.Viewport sets. */
export const PopoverViewportCssVariables = {
	/** The width of the popup. */
	popupWidth: "--popup-width",
	/** The height of the popup. */
	popupHeight: "--popup-height",
} as const;

/** The data attributes Popover.Viewport renders. */
export const PopoverViewportDataAttributes = {
	/** Applied to the direct child of the viewport when no transitions are present. */
	current: "data-current",
	/** Applied to the direct child of the viewport that contains the exiting content. */
	previous: "data-previous",
	/** Indicates the direction from which the popup was activated. */
	activationDirection: "data-activation-direction",
	/** Indicates that the viewport is transitioning between contents. */
	transitioning: "data-transitioning",
	/** Present if animations should be instant. */
	instant: "data-instant",
} as const;

const POPUP_OPEN = { [PopoverTriggerDataAttributes.popupOpen]: "" };
const PRESSED_POPUP_OPEN = { ...POPUP_OPEN, [PopoverTriggerDataAttributes.pressed]: "" };

/**
 * Trigger state → data attributes: `data-popup-open` while this trigger's popover is open, with
 * `data-pressed` when a press of this trigger opened it. A function of `pressed`, because that is
 * not part of the trigger's state.
 */
export function popoverTriggerAttributes(
	pressed: boolean,
): StateAttributesMapping<PopoverTriggerState> {
	return {
		open(value: boolean): Record<string, string> | null {
			if (!value) {
				return null;
			}
			return pressed ? PRESSED_POPUP_OPEN : POPUP_OPEN;
		},
	};
}

/** Positioner state → `data-open` / `data-closed`, `data-anchor-hidden`. */
export const popoverPositionerAttributes: StateAttributesMapping<PopoverPositionerState> =
	popupStateMapping;

/** Popup state → the open attributes and `data-starting-style` / `data-ending-style`. */
export const popoverPopupAttributes: StateAttributesMapping<PopoverPopupState> =
	popupTransitionStateMapping;

/** Arrow state → `data-open` / `data-closed`. */
export const popoverArrowAttributes: StateAttributesMapping<PopoverArrowState> = popupStateMapping;

/** Backdrop state → the open attributes and `data-starting-style` / `data-ending-style`. */
export const popoverBackdropAttributes: StateAttributesMapping<PopoverBackdropState> =
	popupTransitionStateMapping;

/** Viewport state → `data-activation-direction`. */
export const popoverViewportAttributes: StateAttributesMapping<PopoverViewportState> =
	popupViewportStateMapping;
