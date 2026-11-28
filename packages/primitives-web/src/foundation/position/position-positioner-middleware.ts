import type { Middleware, RootBoundary } from "@floating-ui/dom";
import {
	getSide,
	type Measured,
	measureFromFarEdges,
	positionerMiddleware,
	type PositionerMiddlewareOptions,
} from "@sohedra/primitives-core/foundation/position/index.js";

import { ownerDocument, ownerWindow } from "../kernel/index.js";
import { PositionerCssVars } from "./position-attributes.js";

export type { Measured };

export type Boundary =
	| "clipping-ancestors"
	| Element
	| Element[]
	| { x: number; y: number; width: number; height: number };

/**
 * Overrides of the shift a popup's collision avoidance sets up (a context menu shifts along both
 * axes within the layout viewport, so it stays at the pointer instead of flipping).
 */
export interface ShiftOptions {
	/** Shifts along the cross axis too, and never flips to the other side. */
	readonly crossAxis?: boolean | undefined;
	/** The root boundary the shift keeps the popup within. */
	readonly rootBoundary?: RootBoundary | undefined;
}

/**
 * The placement options of one computation, as plain values. `side`, `rtl` and `arrowElement`
 * are read again while the computation runs, so an object that keeps them current also sees an
 * Arrow that registered just after the computation started.
 */
export interface MiddlewareConfig extends PositionerMiddlewareOptions {
	readonly collisionBoundary: Boundary;
	/** Whether a Viewport asks for the popup to be measured from its far edges. */
	readonly adaptiveOrigin: boolean;
	/** The Arrow part's element. */
	readonly arrowElement: HTMLElement | null;
	/** Positions against one line box of a wrapped anchor; runs first. */
	readonly inline?: Middleware | undefined;
	readonly shift?: ShiftOptions | undefined;
}

export function getDevicePixelRatio(element: Element): number {
	return ownerWindow(element).devicePixelRatio || 1;
}

/** A length in pixels, as CSS writes it. */
export function toPx(value: number): string {
	return `${value}px`;
}

/**
 * The middleware of one computation: core's positioning steps, measured on the DOM, with the
 * web's own steps at either end (the inline anchor first and, for a Viewport, the far-edge
 * measurement last). What the steps measure lands in `measured`.
 */
export function createPositionerMiddleware(
	config: MiddlewareConfig,
	measured: Measured,
): Middleware[] {
	const boundary = config.collisionBoundary;
	return positionerMiddleware(
		config,
		{
			boundary: boundary === "clipping-ancestors" ? "clippingAncestors" : boundary,
			arrow: {
				box() {
					const arrowElement = config.arrowElement;
					if (!arrowElement) {
						return null;
					}
					const { width, height } = arrowElement.getBoundingClientRect();
					return { width, height };
				},
				inner() {
					const arrowElement = config.arrowElement;
					return arrowElement
						? { width: arrowElement.clientWidth || 0, height: arrowElement.clientHeight || 0 }
						: null;
				},
				// Without an Arrow part an empty element is measured.
				async measure(state, place) {
					const realElement = config.arrowElement;
					const element =
						realElement || ownerDocument(state.elements.floating).createElement("div");
					const floating: HTMLElement = state.elements.floating;
					const size = await state.platform.getDimensions(element);
					return place({
						present: realElement != null,
						size,
						popupClient: { width: floating.clientWidth, height: floating.clientHeight },
					});
				},
			},
			anchorOverflow: async (state, next) =>
				next(await state.platform.detectOverflow(state, { elementContext: "reference" })),
			devicePixelRatio: (state) => getDevicePixelRatio(state.elements.floating),
			sized({ elements, availableWidth, availableHeight }) {
				// Set right away too, so the rest of this computation (a flip after a capped height)
				// measures the constrained popup.
				const floating: HTMLElement = elements.floating;
				floating.style.setProperty(PositionerCssVars.availableWidth, toPx(availableWidth));
				floating.style.setProperty(PositionerCssVars.availableHeight, toPx(availableHeight));
			},
			// A style read, so it is read only when the transform origin asks.
			popupRtl: (state) =>
				(state.platform.isRTL?.(state.elements.floating) as boolean | undefined) === true,
			first: config.inline,
			last: config.adaptiveOrigin ? adaptiveOriginMiddleware : null,
		},
		measured,
	);
}

// With a transition on the positioner, places it from the right and bottom edges on the left and
// top sides, so a size change grows away from the anchor.
const adaptiveOriginMiddleware: Middleware = {
	name: "adaptiveOrigin",
	async fn(state) {
		const { x: rawX, y: rawY, rects, elements, platform, strategy, placement } = state;
		const floating = elements.floating;
		const win = ownerWindow(floating);
		const duration = win.getComputedStyle(floating).transitionDuration;
		if (duration === "0s" || duration === "") {
			return { x: rawX, y: rawY, data: { sideX: "left", sideY: "top" } };
		}
		const offsetParent = await platform.getOffsetParent?.(floating);
		let container = { width: 0, height: 0 };
		if (strategy === "fixed" && win.visualViewport) {
			container = { width: win.visualViewport.width, height: win.visualViewport.height };
		} else if (offsetParent === win) {
			const doc = ownerDocument(floating);
			container = {
				width: doc.documentElement.clientWidth,
				height: doc.documentElement.clientHeight,
			};
		} else if (await platform.isElement?.(offsetParent)) {
			container = await platform.getDimensions(offsetParent as Element);
		}
		const { x, y, sideX, sideY } = measureFromFarEdges(
			getSide(placement),
			{ x: rawX, y: rawY },
			rects.floating,
			container,
		);
		return { x, y, data: { sideX, sideY } };
	},
};
