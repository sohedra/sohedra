// Popover's styling hooks on the web: the data attributes and CSS variables its parts render, each
// read from the job that writes it. The state → attribute mappings are the popup and position
// jobs'.

import { PopupDataAttributes, PopupTriggerDataAttributes } from "../../foundation/popup/index.js";
import {
	PopupSizeCssVariables,
	PositionerCssVariables,
	ViewportDataAttributes,
} from "../../foundation/position/index.js";
import { TransitionStatusDataAttributes } from "../../foundation/presence/index.js";

/** The data attributes Popover.Trigger renders. */
export const PopoverTriggerDataAttributes = {
	/** Present when the corresponding popover is open. */
	popupOpen: PopupTriggerDataAttributes.popupOpen,
	/** Present when the trigger is pressed. */
	pressed: PopupTriggerDataAttributes.pressed,
	/** Present when the trigger is disabled. */
	disabled: PopupTriggerDataAttributes.disabled,
} as const;

/** The CSS variables Popover.Positioner sets. */
export const PopoverPositionerCssVariables = {
	/** The available width between the trigger and the edge of the viewport. */
	availableWidth: PositionerCssVariables.availableWidth,
	/** The available height between the trigger and the edge of the viewport. */
	availableHeight: PositionerCssVariables.availableHeight,
	/** The anchor's width. */
	anchorWidth: PositionerCssVariables.anchorWidth,
	/** The anchor's height. */
	anchorHeight: PositionerCssVariables.anchorHeight,
	/** The coordinates that this element is anchored to. Used for animations and transitions. */
	transformOrigin: PositionerCssVariables.transformOrigin,
	/** The width of the popover's positioner. */
	positionerWidth: PositionerCssVariables.positionerWidth,
	/** The height of the popover's positioner. */
	positionerHeight: PositionerCssVariables.positionerHeight,
} as const;

/** The data attributes Popover.Positioner renders. */
export const PopoverPositionerDataAttributes = {
	/** Present when the popup is open. */
	open: PopupDataAttributes.open,
	/** Present when the popup is closed. */
	closed: PopupDataAttributes.closed,
	/** Present when the anchor is hidden. */
	anchorHidden: PopupDataAttributes.anchorHidden,
	/** Which side the popup is positioned relative to the trigger. */
	side: PopupDataAttributes.side,
	/** How the popup is aligned relative to the specified side. */
	align: PopupDataAttributes.align,
	/** Present if animations should be instant. */
	instant: PopupDataAttributes.instant,
} as const;

/** The CSS variables Popover.Popup sets. */
export const PopoverPopupCssVariables = {
	/** The width of the popup. */
	popupWidth: PopupSizeCssVariables.popupWidth,
	/** The height of the popup. */
	popupHeight: PopupSizeCssVariables.popupHeight,
} as const;

/** The data attributes Popover.Popup renders. */
export const PopoverPopupDataAttributes = {
	/** Present when the popup is open. */
	open: PopupDataAttributes.open,
	/** Present when the popup is closed. */
	closed: PopupDataAttributes.closed,
	/** Present when the popup begins animating in. */
	startingStyle: TransitionStatusDataAttributes.startingStyle,
	/** Present when the popup is animating out. */
	endingStyle: TransitionStatusDataAttributes.endingStyle,
	/** Which side the popup is positioned relative to the trigger. */
	side: PopupDataAttributes.side,
	/** How the popup is aligned relative to the specified side. */
	align: PopupDataAttributes.align,
	/** Present if animations should be instant. */
	instant: PopupDataAttributes.instant,
} as const;

/** The data attributes Popover.Arrow renders. */
export const PopoverArrowDataAttributes = {
	/** Present when the popup is open. */
	open: PopupDataAttributes.open,
	/** Present when the popup is closed. */
	closed: PopupDataAttributes.closed,
	/** Which side the popup is positioned relative to the trigger. */
	side: PopupDataAttributes.side,
	/** How the popup is aligned relative to the specified side. */
	align: PopupDataAttributes.align,
	/** Present when the popover arrow is uncentered. */
	uncentered: PopupDataAttributes.uncentered,
} as const;

/** The data attributes Popover.Backdrop renders. */
export const PopoverBackdropDataAttributes = {
	/** Present when the popup is open. */
	open: PopupDataAttributes.open,
	/** Present when the popup is closed. */
	closed: PopupDataAttributes.closed,
	/** Present when the popup begins animating in. */
	startingStyle: TransitionStatusDataAttributes.startingStyle,
	/** Present when the popup is animating out. */
	endingStyle: TransitionStatusDataAttributes.endingStyle,
} as const;

/** The CSS variables Popover.Viewport sets. */
export const PopoverViewportCssVariables = {
	/** The width of the popup. */
	popupWidth: PopupSizeCssVariables.popupWidth,
	/** The height of the popup. */
	popupHeight: PopupSizeCssVariables.popupHeight,
} as const;

/** The data attributes Popover.Viewport renders. */
export const PopoverViewportDataAttributes = {
	/** Applied to the direct child of the viewport when no transitions are present. */
	current: ViewportDataAttributes.current,
	/** Applied to the direct child of the viewport that contains the exiting content. */
	previous: ViewportDataAttributes.previous,
	/** Indicates the direction from which the popup was activated. */
	activationDirection: ViewportDataAttributes.activationDirection,
	/** Indicates that the viewport is transitioning between contents. */
	transitioning: ViewportDataAttributes.transitioning,
	/** Present if animations should be instant. */
	instant: PopupDataAttributes.instant,
} as const;
