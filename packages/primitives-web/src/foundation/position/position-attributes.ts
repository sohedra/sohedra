// The styling hooks the position job writes: the CSS variables a Positioner sets on its element,
// the popup size variables a Viewport sets, and the Viewport's data attributes and how its state
// maps to them.
import type { AnchoredViewportState } from "@sohedra/primitives-core/foundation/position";

import type { StateAttributesMapping } from "../kernel/index.js";

/** The CSS variables a Positioner sets. */
export const PositionerCssVariables = {
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
	/** The width of the positioner. */
	positionerWidth: "--positioner-width",
	/** The height of the positioner. */
	positionerHeight: "--positioner-height",
} as const;

/** The CSS variables of the popup's size, which a Viewport sets while its content changes. */
export const PopupSizeCssVariables = {
	/** The width of the popup. */
	popupWidth: "--popup-width",
	/** The height of the popup. */
	popupHeight: "--popup-height",
} as const;

/** The data attributes a Viewport renders. */
export const ViewportDataAttributes = {
	/** Applied to the direct child of the viewport when no transitions are present. */
	current: "data-current",
	/** Applied to the direct child of the viewport that contains the exiting content. */
	previous: "data-previous",
	/** Indicates the direction from which the popup was activated. */
	activationDirection: "data-activation-direction",
	/** Indicates that the viewport is transitioning between contents. */
	transitioning: "data-transitioning",
} as const;

/** A Viewport's `activationDirection` → `data-activation-direction`. */
export const viewportStateMapping = {
	activationDirection(value: string | undefined): Record<string, string> | null {
		return value ? { [ViewportDataAttributes.activationDirection]: value } : null;
	},
} satisfies StateAttributesMapping<Pick<AnchoredViewportState, "activationDirection">>;
