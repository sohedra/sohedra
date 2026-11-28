// The CSS variables a Positioner sets on its element.

/** The CSS variables a Positioner sets. */
export const PositionerCssVars = {
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
