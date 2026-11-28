// The words of placement: sides, alignment, how a popup avoids collisions, its offset, and the
// measured position a Positioner shares with its parts.

/** The side of the anchor a popup is placed on, logical sides included. */
export type Side = "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start";

/** The alignment of a popup relative to its side. */
export type Align = "start" | "center" | "end";

/** A physical side. */
export type PhysicalSide = "top" | "right" | "bottom" | "left";

/** How a positioned popup avoids collisions with its boundary. */
export type CollisionAvoidance =
	| {
			side?: "flip" | "none" | undefined;
			align?: "flip" | "shift" | "none" | undefined;
			fallbackAxisSide?: "start" | "end" | "none" | undefined;
	  }
	| {
			side?: "shift" | "none" | undefined;
			align?: "shift" | "none" | undefined;
			fallbackAxisSide?: "start" | "end" | "none" | undefined;
	  };

/** An offset, or a function of the placement and sizes returning one. */
export type OffsetFunction = (data: {
	side: Side;
	align: Align;
	anchor: { width: number; height: number };
	positioner: { width: number; height: number };
}) => number;

/**
 * One axis of a transform origin, measured from the popup's start edge: a percentage of its size,
 * a pixel offset, or both (`percent% + px`).
 */
export interface OriginOffset {
	readonly percent?: number | undefined;
	readonly px?: number | undefined;
}

/**
 * The measured position of a popup: written by the platform layer after each computation and
 * read by the Positioner, Popup and Arrow, which derive their styles and data attributes from it.
 */
export interface MeasuredPosition {
	/** Whether the position was computed for the current opening. */
	readonly isPositioned: boolean;
	readonly x: number;
	readonly y: number;
	readonly strategy: "absolute" | "fixed";
	/** The rendered side, logical when a logical side was asked for. */
	readonly side: Side;
	readonly physicalSide: PhysicalSide;
	readonly align: Align;
	readonly anchorHidden: boolean;
	readonly arrow: {
		readonly x?: number | undefined;
		readonly y?: number | undefined;
		readonly centerOffset: number;
	} | null;
	/** The space between the anchor and the collision boundary, once measured. */
	readonly availableWidth?: number | undefined;
	readonly availableHeight?: number | undefined;
	/** The anchor's size, snapped to device pixels, once measured. */
	readonly anchorWidth?: number | undefined;
	readonly anchorHeight?: number | undefined;
	/** Where the popup grows from (for animations), once measured. */
	readonly transformOrigin?: { readonly x: OriginOffset; readonly y: OriginOffset } | undefined;
	/** The edges the position is measured from, when a Viewport asks for an adaptive origin. */
	readonly sides?:
		| { readonly sideX: "left" | "right"; readonly sideY: "top" | "bottom" }
		| undefined;
}
