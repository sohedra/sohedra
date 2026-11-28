// The steps of one positioning computation, in their order: offset, flip and shift as the
// collision plan says, size, the arrow, the transform origin and whether the anchor is hidden.
// They are built from the placement rules on the platform-free half of Floating UI. A platform
// runs them with its own `computePosition`, says how it measures, and may add a step at either
// end; what the steps find lands in `measured`.

import {
	flip,
	limitShift,
	type Middleware,
	type MiddlewareReturn,
	type MiddlewareState,
	offset,
	type RootBoundary,
	shift,
	type SideObject,
	size,
} from "@floating-ui/core";

import {
	collisionPlan,
	flipPadding,
	getSide,
	isAnchorHidden,
	normalizePadding,
	offsetInput,
	placeArrow,
	shiftLimitOffset,
	type Size,
	snapLength,
	transformOrigin,
} from "./position-rules.js";
import type {
	Align,
	CollisionAvoidance,
	OffsetFunction,
	OriginOffset,
	Padding,
	Side,
} from "./position-types.js";

/** A step's answer: now, or once the platform has measured what it needs. */
export type StepResult = MiddlewareReturn | Promise<MiddlewareReturn>;

/**
 * The placement options of one computation. `side` and `rtl` are read while it runs, so an object
 * that keeps them current is followed; the others are read once, when the steps are built.
 */
export interface PositionerMiddlewareOptions {
	readonly side: Side;
	readonly align: Align;
	readonly rtl: boolean;
	readonly sideOffset: number | OffsetFunction;
	readonly alignOffset: number | OffsetFunction;
	readonly sticky: boolean;
	readonly arrowPadding: number;
	readonly collisionPadding: Padding;
	readonly collisionAvoidance: CollisionAvoidance;
	/**
	 * Overrides of the shift collision avoidance sets up (a context menu shifts along both axes
	 * within the layout viewport, so it stays at the pointer instead of flipping).
	 */
	readonly shift?:
		| {
				/** Shifts along the cross axis too, and never flips to the other side. */
				readonly crossAxis?: boolean | undefined;
				/** The root boundary the shift keeps the popup within. */
				readonly rootBoundary?: RootBoundary | undefined;
		  }
		| undefined;
}

/** The arrow as a platform measured it for placing it. */
export interface ArrowMeasure {
	/** Whether the popup has an Arrow part. Without one a virtual arrow is placed, with no padding. */
	readonly present: boolean;
	readonly size: Size;
	/** The popup's inner size; along an axis where it is zero, its outer size counts. */
	readonly popupClient: Size;
}

/** How a platform measures the Arrow part, at each point a step reads it. */
export interface PositionerArrow {
	/** Its outer size, which a limited shift keeps on the anchor; `null` without an Arrow part. */
	box(): Size | null;
	/** Its inner size, whose centre the popup grows from; `null` without an Arrow part. */
	inner(): Size | null;
	/**
	 * Measures it for placing, now or asynchronously, and hands the measurement to `place`. Without
	 * an Arrow part a virtual one is measured, because the transform origin is taken from it.
	 */
	measure(state: MiddlewareState, place: (arrow: ArrowMeasure) => MiddlewareReturn): StepResult;
}

/** What a platform adds to the steps: how it measures, and steps of its own at either end. */
export interface PlatformPositioning {
	readonly arrow: PositionerArrow;
	/**
	 * Measures how far the anchor overflows the area it is clipped to and hands that to `next`.
	 * The positioning library measures it asynchronously
	 * (`state.platform.detectOverflow(state, { elementContext: "reference" })`) and core never
	 * awaits, so the platform waits.
	 */
	anchorOverflow(
		state: MiddlewareState,
		next: (overflow: SideObject) => MiddlewareReturn,
	): StepResult;
	/** The area flip, shift and size keep the popup in, handed to the library as it is. */
	readonly boundary?: unknown;
	/** The popup's device pixel ratio, which the anchor's size is snapped to; unsnapped without. */
	devicePixelRatio?(state: MiddlewareState): number;
	/** Called by the size step once `measured` holds the room the popup has. */
	sized?(state: MiddlewareState & { availableWidth: number; availableHeight: number }): void;
	/** The popup's own text direction, read only when the transform origin asks; `rtl` without. */
	popupRtl?(state: MiddlewareState): boolean;
	/** A step that runs before every other one. */
	readonly first?: Middleware | null | undefined;
	/** A step that runs after every other one. */
	readonly last?: Middleware | null | undefined;
}

/** What the steps measured during one computation. */
export interface Measured {
	availableWidth?: number;
	availableHeight?: number;
	anchorWidth?: number;
	anchorHeight?: number;
	transformOrigin?: { x: OriginOffset; y: OriginOffset };
	anchorHidden?: boolean;
}

const NO_SIZE: Size = { width: 0, height: 0 };

/**
 * An Arrow measured once before the computation, on a platform that measures outer boxes only:
 * the same size at every point, and the popup's inner size taken to be its outer size.
 */
export function measuredArrow(arrow: Size | null): PositionerArrow {
	return {
		box: () => arrow,
		inner: () => arrow,
		measure: (state, place) =>
			place({ present: arrow != null, size: arrow ?? NO_SIZE, popupClient: state.rects.floating }),
	};
}

/** The steps of one computation, in the order they run. */
export function positionerMiddleware(
	options: PositionerMiddlewareOptions,
	platform: PlatformPositioning,
	measured: Measured,
): Middleware[] {
	const { sideOffset, alignOffset, arrowPadding } = options;
	const padding = normalizePadding(options.collisionPadding);
	const boundary = platform.boundary;
	const arrow = platform.arrow;
	const plan = collisionPlan(options.collisionAvoidance, {
		align: options.align,
		sticky: options.sticky,
		shiftCrossAxis: options.shift?.crossAxis ?? false,
	});
	const offsets = (state: MiddlewareState) =>
		offsetInput(
			options.side,
			state.placement,
			options.rtl,
			state.rects.reference,
			state.rects.floating,
		);
	const resolvedSideOffset = (state: MiddlewareState) =>
		typeof sideOffset === "function" ? sideOffset(offsets(state)) : sideOffset;

	// Whether the size step has run in this computation. It runs after the flip, and when it lets
	// a capped popup grow the computation starts over, so the flip then measures the popup it sized.
	let sized = false;
	const flipOptions = plan.flip;
	const flipStep = flipOptions
		? flip(() => ({
				boundary,
				padding: flipPadding(padding, options.side, sized),
				mainAxis: flipOptions.mainAxis,
				crossAxis: flipOptions.crossAxis,
				fallbackAxisSideDirection: flipOptions.fallbackAxisSide,
			}))
		: null;
	const shiftStep = plan.shift
		? shift({
				boundary,
				padding,
				// The layout viewport by default, so pinch-zooming doesn't shift the popup around.
				rootBoundary: options.shift?.rootBoundary,
				mainAxis: plan.shift.mainAxis,
				crossAxis: plan.shift.crossAxis,
				// A limited shift stops before the arrow leaves the anchor.
				limiter: plan.shift.limited
					? limitShift((state) => {
							const box = arrow.box();
							return box
								? { offset: shiftLimitOffset(box, getSide(state.placement), padding) }
								: {};
						})
					: undefined,
			})
		: null;

	const steps: (Middleware | null | undefined)[] = [
		platform.first,
		offset((state) => {
			// One input for both, the side's offset asked first.
			const data = offsets(state);
			const sideAxis = typeof sideOffset === "function" ? sideOffset(data) : sideOffset;
			const alignAxis = typeof alignOffset === "function" ? alignOffset(data) : alignOffset;
			return { mainAxis: sideAxis, crossAxis: alignAxis, alignmentAxis: alignAxis };
		}),
		// The library's advice on combining the two: a shift first keeps a centred popup centred.
		...(plan.shiftFirst ? [shiftStep, flipStep] : [flipStep, shiftStep]),
		size({
			boundary,
			padding,
			apply(state) {
				sized = true;
				measured.availableWidth = state.availableWidth;
				measured.availableHeight = state.availableHeight;
				// Snapped to device pixels, so the popup's width matches the anchor's.
				const ratio = platform.devicePixelRatio?.(state);
				const { x, y, width, height } = state.rects.reference;
				measured.anchorWidth = ratio ? snapLength(x, width, ratio) : width;
				measured.anchorHeight = ratio ? snapLength(y, height, ratio) : height;
				platform.sized?.(state);
			},
		}),
		{
			// Places the arrow so it points at the anchor's centre.
			name: "arrow",
			fn: (state) =>
				arrow.measure(state, (measure) => {
					const { x, y, placement, rects, middlewareData } = state;
					const placed = placeArrow({
						placement,
						x,
						y,
						anchor: rects.reference,
						popup: rects.floating,
						popupClient: measure.popupClient,
						arrow: measure.size,
						padding: normalizePadding(measure.present ? arrowPadding : 0),
						placed: Boolean(middlewareData.arrow),
					});
					return {
						[placed.axis]: (placed.axis === "x" ? x : y) + placed.alignmentOffset,
						data: {
							[placed.axis]: placed.offset,
							centerOffset: placed.centerOffset,
							...(placed.movesPopup && { alignmentOffset: placed.alignmentOffset }),
						},
						reset: placed.movesPopup,
					};
				}),
		},
		{
			name: "transformOrigin",
			fn(state) {
				const { middlewareData } = state;
				const inner = arrow.inner();
				measured.transformOrigin = transformOrigin({
					placement: state.placement,
					hasArrow: inner != null,
					arrow: inner ?? NO_SIZE,
					arrowOffset: { x: middlewareData.arrow?.x, y: middlewareData.arrow?.y },
					shift: { x: middlewareData.shift?.x || 0, y: middlewareData.shift?.y || 0 },
					get rtl() {
						return platform.popupRtl ? platform.popupRtl(state) : options.rtl;
					},
					sideOffset: resolvedSideOffset(state),
					crossAxisShiftEnabled: plan.crossAxisShiftEnabled,
					anchor: state.rects.reference,
					y: state.y,
				});
				return {};
			},
		},
		{
			// The anchor is hidden when it is clipped away, and also when it is a zero-size rectangle
			// at the origin.
			name: "hide",
			fn: (state) =>
				platform.anchorOverflow(state, (overflow) => {
					const hidden = isAnchorHidden(state.rects.reference, overflow);
					measured.anchorHidden = hidden;
					return { data: { referenceHidden: hidden } };
				}),
		},
		platform.last,
	];
	return steps.filter((step): step is Middleware => step != null);
}
