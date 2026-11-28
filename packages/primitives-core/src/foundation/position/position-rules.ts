// Placing a popup against its anchor, as pure functions: rectangles and plain values in, the
// answer out. The platform layer measures, asks these, and applies what they say.

import type {
	Align,
	CollisionAvoidance,
	OriginOffset,
	PhysicalSide,
	PositionState,
	Side,
} from "./position-types.js";

/** The alignment a placement carries; a centred one carries none. */
export type Alignment = "start" | "end";

/** A physical side with an optional alignment: `bottom`, `bottom-start`. */
export type Placement = PhysicalSide | `${PhysicalSide}-${Alignment}`;

export interface Size {
	readonly width: number;
	readonly height: number;
}

export interface Rect extends Size {
	readonly x: number;
	readonly y: number;
}

/** A distance per side. */
export interface SideDistances {
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

/** A padding as a part gives it: one number for every side, or a number per side. */
export type PaddingInput =
	| number
	| {
			readonly top?: number | undefined;
			readonly right?: number | undefined;
			readonly bottom?: number | undefined;
			readonly left?: number | undefined;
	  };

/** The placement a Positioner asks for, before anything is measured. */
export interface PositionerRequest {
	readonly side: Side;
	readonly align: Align;
	readonly rtl: boolean;
}

/** What a Positioner part uses for the placement props its user leaves out. */
export const POSITIONER_DEFAULTS = {
	align: "center",
	sideOffset: 0,
	alignOffset: 0,
	collisionPadding: 5,
	collisionAvoidance: { fallbackAxisSide: "end" },
	sticky: false,
	arrowPadding: 5,
} as const satisfies {
	align: Align;
	sideOffset: number;
	alignOffset: number;
	collisionPadding: PaddingInput;
	collisionAvoidance: CollisionAvoidance;
	sticky: boolean;
	arrowPadding: number;
};

/** The physical side a requested (possibly logical) side resolves to. */
export function physicalSide(side: Side, rtl: boolean): PhysicalSide {
	switch (side) {
		case "inline-end":
			return rtl ? "left" : "right";
		case "inline-start":
			return rtl ? "right" : "left";
		default:
			return side;
	}
}

/** The side a Positioner reports for a rendered physical side: logical when asked logically. */
export function logicalSide(requested: Side, rendered: PhysicalSide, rtl: boolean): Side {
	const isLogical = requested === "inline-start" || requested === "inline-end";
	if (rendered === "right") {
		return isLogical ? (rtl ? "inline-start" : "inline-end") : "right";
	}
	if (rendered === "left") {
		return isLogical ? (rtl ? "inline-end" : "inline-start") : "left";
	}
	return rendered;
}

/** The position before the first measurement: the requested placement, not yet positioned. */
export function initialPosition(request: PositionerRequest): PositionState {
	const rendered = physicalSide(request.side, request.rtl);
	return {
		isPositioned: false,
		x: 0,
		y: 0,
		strategy: "absolute",
		side: logicalSide(request.side, rendered, request.rtl),
		physicalSide: rendered,
		align: request.align,
		anchorHidden: false,
		arrow: null,
	};
}

/** The side of a placement. */
export function getSide(placement: string): PhysicalSide {
	return placement.split("-")[0] as PhysicalSide;
}

/** The alignment of a placement; none when it is centred. */
export function getAlignment(placement: string): Alignment | undefined {
	return placement.split("-")[1] as Alignment | undefined;
}

/** The axis a side lies on: a popup above or below its anchor is on `y`. */
export function getSideAxis(side: PhysicalSide): "x" | "y" {
	return side === "top" || side === "bottom" ? "y" : "x";
}

/** The placement for a physical side and an alignment. */
export function toPlacement(side: PhysicalSide, align: Align): Placement {
	return align === "center" ? side : `${side}-${align}`;
}

export function normalizePadding(padding: PaddingInput): SideDistances {
	if (typeof padding === "number") {
		return { top: padding, right: padding, bottom: padding, left: padding };
	}
	return {
		top: padding.top || 0,
		right: padding.right || 0,
		bottom: padding.bottom || 0,
		left: padding.left || 0,
	};
}

/**
 * The placement to ask for: the requested side and alignment, unless a flipped placement is kept
 * (lazy flipping), whose side, and with `'placement'` its alignment too, wins.
 */
export function requestedPlacement(
	request: PositionerRequest,
	kept: string | null,
	lazyFlip: boolean | "placement",
): Placement {
	const side = kept ? getSide(kept) : physicalSide(request.side, request.rtl);
	const keptAlign = kept && lazyFlip === "placement" ? getAlignment(kept) || "center" : null;
	return toPlacement(side, keptAlign ?? request.align);
}

/**
 * Whether a positioned result is kept for the rest of the opening (lazy flipping): when its side
 * differs from the one asked for, and with `'placement'` when its alignment does. Content that
 * resizes the popup then doesn't make it jump back and forth.
 */
export function keepsPlacement(
	lazyFlip: boolean | "placement",
	requested: string,
	rendered: string,
): boolean {
	if (!lazyFlip) {
		return false;
	}
	const sideChanged = getSide(rendered) !== getSide(requested);
	const alignChanged =
		(getAlignment(rendered) || "center") !== (getAlignment(requested) || "center");
	return sideChanged || (lazyFlip === "placement" && alignChanged);
}

/** What a part's offset function is given for one computation. */
export function offsetInput(
	requestedSide: Side,
	placement: string,
	rtl: boolean,
	anchor: Size,
	positioner: Size,
) {
	return {
		side: logicalSide(requestedSide, getSide(placement), rtl),
		align: getAlignment(placement) || ("center" as const),
		anchor: { width: anchor.width, height: anchor.height },
		positioner: { width: positioner.width, height: positioner.height },
	};
}

/** How one computation avoids collisions: what flips, what shifts, and which runs first. */
export interface CollisionPlan {
	/** `null` when the popup never flips. */
	readonly flip: {
		readonly mainAxis: boolean;
		readonly crossAxis: "alignment" | false;
		readonly fallbackAxisSide: "start" | "end" | "none";
	} | null;
	/** `null` when the popup never shifts. */
	readonly shift: {
		readonly mainAxis: boolean;
		readonly crossAxis: boolean;
		/** Whether the shift stops before the arrow leaves the anchor. */
		readonly limited: boolean;
	} | null;
	/** Whether the shift runs before the flip. */
	readonly shiftFirst: boolean;
	/** Whether the popup can shift along the side's own axis (sticky, or a side that shifts). */
	readonly crossAxisShiftEnabled: boolean;
}

/** The collision plan for a part's `collisionAvoidance`, alignment and shift overrides. */
export function collisionPlan(
	avoidance: CollisionAvoidance,
	input: { readonly align: Align; readonly sticky: boolean; readonly shiftCrossAxis: boolean },
): CollisionPlan {
	const avoidSide = avoidance.side || "flip";
	const avoidAlign = avoidance.align || "flip";
	const fallbackAxisSide = avoidance.fallbackAxisSide || "end";
	const shiftDisabled = avoidAlign === "none" && avoidSide !== "shift";
	const crossAxisShiftEnabled =
		!shiftDisabled && (input.sticky || input.shiftCrossAxis || avoidSide === "shift");
	return {
		flip:
			avoidSide === "none"
				? null
				: {
						mainAxis: !input.shiftCrossAxis && avoidSide === "flip",
						crossAxis: avoidAlign === "flip" ? "alignment" : false,
						fallbackAxisSide,
					},
		shift: shiftDisabled
			? null
			: {
					mainAxis: avoidAlign !== "none",
					crossAxis: crossAxisShiftEnabled,
					limited: !(input.sticky || input.shiftCrossAxis),
				},
		shiftFirst: avoidSide === "shift" || avoidAlign === "shift" || input.align === "center",
		crossAxisShiftEnabled,
	};
}

const FLIP_BIAS = 1;

/**
 * The collision padding a flip measures with: one pixel more on every side, and one more again
 * on the side opposite the requested one, so the popup prefers the side it was asked for (a
 * phone centres a focused input exactly).
 *
 * `capRaised`: this computation already sized the popup on the side being tried. A popup capped
 * to the room it has then fills that room to the plain padding, so the extra pixels would count
 * it as overflowing and send it back to the smaller side it just left: the plain padding is used.
 */
export function flipPadding(
	padding: SideDistances,
	requestedSide: Side,
	capRaised = false,
): SideDistances {
	if (capRaised) {
		return padding;
	}
	return {
		top: padding.top + FLIP_BIAS + (requestedSide === "bottom" ? FLIP_BIAS : 0),
		right: padding.right + FLIP_BIAS + (requestedSide === "left" ? FLIP_BIAS : 0),
		bottom: padding.bottom + FLIP_BIAS + (requestedSide === "top" ? FLIP_BIAS : 0),
		left: padding.left + FLIP_BIAS + (requestedSide === "right" ? FLIP_BIAS : 0),
	};
}

/** How far a limited shift may move the popup: until half the arrow has left the anchor. */
export function shiftLimitOffset(arrow: Size, side: PhysicalSide, padding: SideDistances): number {
	const vertical = getSideAxis(side) === "y";
	const arrowSize = vertical ? arrow.width : arrow.height;
	const paddingAmount = vertical ? padding.left + padding.right : padding.top + padding.bottom;
	return arrowSize / 2 + paddingAmount / 2;
}

/** A length rounded to the device's pixels. */
export function roundToDevicePixels(value: number, devicePixelRatio: number): number {
	return Math.round(value * devicePixelRatio) / devicePixelRatio;
}

/** A length from `start`, snapped to device pixels at both ends, so it matches what is drawn. */
export function snapLength(start: number, length: number, devicePixelRatio: number): number {
	return (
		(Math.round((start + length) * devicePixelRatio) - Math.round(start * devicePixelRatio)) /
		devicePixelRatio
	);
}

/**
 * Whether the anchor is out of sight: clipped away on some side by `overflow` (how far it
 * overflows its clipping area per side), or a zero-size rectangle at the origin.
 */
export function isAnchorHidden(anchor: Rect, overflow: SideDistances): boolean {
	const { width, height, x, y } = anchor;
	const collapsed = width === 0 && height === 0 && x === 0 && y === 0;
	const clipped =
		overflow.top - height >= 0 ||
		overflow.right - width >= 0 ||
		overflow.bottom - height >= 0 ||
		overflow.left - width >= 0;
	return clipped || collapsed;
}

/** What placing an arrow needs: the popup's position, the two rectangles and the arrow's size. */
export interface ArrowInput {
	readonly placement: string;
	/** The popup's position so far. */
	readonly x: number;
	readonly y: number;
	readonly anchor: Rect;
	readonly popup: Size;
	/** The popup's inner size; along an axis where it is zero, its outer size counts. */
	readonly popupClient: Size;
	readonly arrow: Size;
	readonly padding: SideDistances;
	/** Whether this computation already placed the arrow once. */
	readonly placed: boolean;
}

export interface ArrowPlacement {
	/** The axis the arrow moves along. */
	readonly axis: "x" | "y";
	/** The arrow's offset from the popup's start edge. */
	readonly offset: number;
	/** How far the arrow is from pointing at the anchor's centre. */
	readonly centerOffset: number;
	/**
	 * Whether the popup itself moves along `axis`, for an anchor too small for the arrow's padding.
	 * It moves once: the computation then runs again.
	 */
	readonly movesPopup: boolean;
	/** How far it moves; zero when it doesn't. */
	readonly alignmentOffset: number;
}

/** Where the arrow goes so it points at the anchor's centre, within its padding. */
export function placeArrow(input: ArrowInput): ArrowPlacement {
	const { placement, anchor, popup, arrow, padding } = input;
	const alignment = getAlignment(placement);
	const axis = getSideAxis(getSide(placement)) === "y" ? "x" : "y";
	const vertical = axis === "y";
	const length = vertical ? "height" : "width";
	const coordinate = vertical ? input.y : input.x;
	const startPadding = vertical ? padding.top : padding.left;
	const endPadding = vertical ? padding.bottom : padding.right;
	const endDiff = anchor[length] + anchor[axis] - coordinate - popup[length];
	const startDiff = coordinate - anchor[axis];
	const clientSize = input.popupClient[length] || popup[length];
	const centerToAnchor = endDiff / 2 - startDiff / 2;
	// Padding too large to centre the arrow shrinks to keep it centred.
	const largestPossiblePadding = clientSize / 2 - arrow[length] / 2 - 1;
	const minPadding = Math.min(startPadding, largestPossiblePadding);
	const maxPadding = Math.min(endPadding, largestPossiblePadding);
	const min = minPadding;
	const max = clientSize - arrow[length] - maxPadding;
	const center = clientSize / 2 - arrow[length] / 2 + centerToAnchor;
	const offset = Math.min(Math.max(min, center), max);
	// An anchor too small for the arrow's padding offsets the popup itself, once.
	const movesPopup =
		!input.placed &&
		alignment != null &&
		center !== offset &&
		anchor[length] / 2 - (center < min ? minPadding : maxPadding) - arrow[length] / 2 < 0;
	const alignmentOffset = movesPopup ? (center < min ? center - min : center - max) : 0;
	return {
		axis,
		offset,
		centerOffset: center - offset - alignmentOffset,
		movesPopup,
		alignmentOffset,
	};
}

/** What the transform origin of one computation depends on. */
export interface TransformOriginInput {
	readonly placement: string;
	/** Whether the popup has an Arrow part. */
	readonly hasArrow: boolean;
	/** The Arrow's inner size; zeros without one. */
	readonly arrow: Size;
	/** The arrow's offsets from {@link placeArrow}, real or virtual. */
	readonly arrowOffset: { readonly x?: number | undefined; readonly y?: number | undefined };
	/** How far collision avoidance shifted the popup. */
	readonly shift: { readonly x: number; readonly y: number };
	/** Whether the popup's own text direction is right to left. Read only for an aligned popup. */
	readonly rtl: boolean;
	readonly sideOffset: number;
	readonly crossAxisShiftEnabled: boolean;
	readonly anchor: Rect;
	/** The popup's top edge. */
	readonly y: number;
}

/**
 * Where the popup grows from: an aligned popup without an arrow from its aligned edge, until a
 * shift breaks the alignment; every other one from the arrow, real or virtual.
 */
export function transformOrigin(input: TransformOriginInput): {
	x: OriginOffset;
	y: OriginOffset;
} {
	const side = getSide(input.placement);
	const alignment = getAlignment(input.placement);
	const vertical = getSideAxis(side) === "y";
	let crossOrigin: OriginOffset;
	if (!input.hasArrow && alignment && Math.abs(vertical ? input.shift.x : input.shift.y) <= 1) {
		crossOrigin = { percent: (alignment === "start") === (vertical && input.rtl) ? 100 : 0 };
	} else {
		const arrowOffset = vertical ? input.arrowOffset.x || 0 : input.arrowOffset.y || 0;
		const arrowSize = vertical ? input.arrow.width : input.arrow.height;
		crossOrigin = { px: arrowOffset + arrowSize / 2 };
	}
	let sideOrigin: OriginOffset =
		side === "top" || side === "left"
			? { percent: 100, px: input.sideOffset }
			: { px: -input.sideOffset };
	if (input.crossAxisShiftEnabled && vertical && Math.abs(input.shift.y) > input.sideOffset) {
		sideOrigin = { px: input.anchor.y + input.anchor.height / 2 - input.y };
	}
	return vertical ? { x: crossOrigin, y: sideOrigin } : { x: sideOrigin, y: crossOrigin };
}

/**
 * A position measured from the far edges on the left and top sides, so a popup that changes size
 * grows away from its anchor. `container` is the area the popup is positioned in.
 */
export function measureFromFarEdges(
	side: PhysicalSide,
	position: { readonly x: number; readonly y: number },
	popup: Size,
	container: Size,
): { x: number; y: number; sideX: "left" | "right"; sideY: "top" | "bottom" } {
	return {
		x: side === "left" ? container.width - (position.x + popup.width) : position.x,
		y: side === "top" ? container.height - (position.y + popup.height) : position.y,
		sideX: side === "left" ? "right" : "left",
		sideY: side === "top" ? "bottom" : "top",
	};
}

function sameOrigin(a: OriginOffset | undefined, b: OriginOffset | undefined) {
	return a?.percent === b?.percent && a?.px === b?.px;
}

/** Whether two computed positions render the same. */
export function samePosition(a: PositionState, b: PositionState): boolean {
	if (
		a.isPositioned !== b.isPositioned ||
		a.x !== b.x ||
		a.y !== b.y ||
		a.strategy !== b.strategy ||
		a.side !== b.side ||
		a.align !== b.align ||
		a.anchorHidden !== b.anchorHidden ||
		a.arrow?.x !== b.arrow?.x ||
		a.arrow?.y !== b.arrow?.y ||
		a.arrow?.centerOffset !== b.arrow?.centerOffset ||
		a.sides?.sideX !== b.sides?.sideX ||
		a.sides?.sideY !== b.sides?.sideY ||
		a.availableWidth !== b.availableWidth ||
		a.availableHeight !== b.availableHeight ||
		a.anchorWidth !== b.anchorWidth ||
		a.anchorHeight !== b.anchorHeight
	) {
		return false;
	}
	return (
		sameOrigin(a.transformOrigin?.x, b.transformOrigin?.x) &&
		sameOrigin(a.transformOrigin?.y, b.transformOrigin?.y)
	);
}
