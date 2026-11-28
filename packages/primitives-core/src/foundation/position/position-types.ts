// The words of placement: sides, alignment, how a popup avoids collisions, its offset and
// padding, the measured position a Positioner shares with its parts, and the state of the parts
// every anchored popup has.

import type { InstantType } from "../popup/index.js";
import type { TransitionStatus } from "../presence/index.js";

/** The side of the anchor a popup is placed on, logical sides included. */
export type Side = "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start";

/** The alignment of a popup relative to its side. */
export type Align = "start" | "center" | "end";

/** A physical side. */
export type PhysicalSide = "top" | "right" | "bottom" | "left";

/** How a positioned popup avoids collisions with its boundary. */
export type CollisionAvoidance =
	| {
			/**
			 * How to avoid collisions on the side axis.
			 * - `'flip'`: If there is not enough space, place the popup on the opposite side.
			 * - `'none'`: Keep the preferred side even if it overflows.
			 */
			side?: "flip" | "none" | undefined;
			/**
			 * How to avoid collisions on the align axis.
			 * - `'flip'`: If there is not enough space, swap `'start'` and `'end'` alignment.
			 * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
			 * - `'none'`: Keep the preferred alignment even if it overflows.
			 */
			align?: "flip" | "shift" | "none" | undefined;
			/**
			 * If both sides on the preferred axis do not fit, whether to fall back to a side on the
			 * perpendicular axis, and which logical side to prefer (`'start'`, `'end'`, or `'none'`
			 * for no fallback).
			 */
			fallbackAxisSide?: "start" | "end" | "none" | undefined;
	  }
	| {
			/**
			 * How to avoid collisions on the side axis.
			 * - `'shift'`: Keep the preferred side and shift the popup to fit within the boundary.
			 * - `'none'`: Keep the preferred side even if it overflows.
			 */
			side?: "shift" | "none" | undefined;
			/**
			 * How to avoid collisions on the align axis.
			 * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
			 * - `'none'`: Keep the preferred alignment even if it overflows.
			 */
			align?: "shift" | "none" | undefined;
			/**
			 * If both sides on the preferred axis do not fit, whether to fall back to a side on the
			 * perpendicular axis, and which logical side to prefer (`'start'`, `'end'`, or `'none'`
			 * for no fallback).
			 */
			fallbackAxisSide?: "start" | "end" | "none" | undefined;
	  };

/** A padding: one number for every side, or a number per side. */
export type Padding =
	| number
	| {
			readonly top?: number | undefined;
			readonly right?: number | undefined;
			readonly bottom?: number | undefined;
			readonly left?: number | undefined;
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
 * The measured position of a popup: written by the platform after each computation and
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

/** An anchored popup's Positioner part's state. */
export interface AnchoredPositionerState {
	/** Whether the popup is currently open. */
	open: boolean;
	/** The side of the anchor the component is placed on. */
	side: Side;
	/** The alignment of the component relative to the anchor. */
	align: Align;
	/** Whether the anchor element is hidden. */
	anchorHidden: boolean;
	/** Why CSS transitions are skipped, if they are. */
	instant: InstantType;
}

/** An anchored popup's Popup part's state: the popup's open state, its Positioner's placement. */
export interface AnchoredPopupState {
	/** Whether the popup is currently open. */
	open: boolean;
	/** The side of the anchor the component is placed on. */
	side: Side;
	/** The alignment of the component relative to the anchor. */
	align: Align;
	/** Why CSS transitions are skipped, if they are. */
	instant: InstantType;
	/** The transition status of the component. */
	transitionStatus: TransitionStatus;
}

/** An anchored popup's Arrow part's state. */
export interface AnchoredArrowState {
	/** Whether the popup is currently open. */
	open: boolean;
	/** The side of the anchor the component is placed on. */
	side: Side;
	/** The alignment of the component relative to the anchor. */
	align: Align;
	/** Whether the arrow cannot be centered on the anchor. */
	uncentered: boolean;
}

/** An anchored popup's Viewport part's state. */
export interface AnchoredViewportState {
	/** The direction the content moved in when the active trigger changed. */
	activationDirection: string | undefined;
	/** Whether the viewport is transitioning between contents. */
	transitioning: boolean;
	/** Why CSS transitions are skipped, if they are. */
	instant: InstantType;
}
