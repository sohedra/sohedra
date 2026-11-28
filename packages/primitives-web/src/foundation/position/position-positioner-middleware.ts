import type { Middleware } from "@floating-ui/dom";
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
 * The placement options of one computation, as plain values. `side`, `rtl` and `arrowElement`
 * are read again while the computation runs, so an object that keeps them current also sees an
 * Arrow that registered just after the computation started.
 */
export interface MiddlewareOptions extends PositionerMiddlewareOptions {
	readonly collisionBoundary: Boundary;
	/** Whether a Viewport asks for the popup to be measured from its far edges. */
	readonly adaptiveOrigin: boolean;
	/** The Arrow part's element. */
	readonly arrowElement: HTMLElement | null;
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
 * web's own step at the end for a Viewport (the far-edge measurement). What the steps measure
 * lands in `measured`.
 */
export function createPositionerMiddleware(
	options: MiddlewareOptions,
	measured: Measured,
): Middleware[] {
	const boundary = options.collisionBoundary;
	return positionerMiddleware(
		options,
		{
			boundary: boundary === "clipping-ancestors" ? "clippingAncestors" : boundary,
			arrow: {
				box() {
					const arrowElement = options.arrowElement;
					if (!arrowElement) {
						return null;
					}
					const { width, height } = arrowElement.getBoundingClientRect();
					return { width, height };
				},
				inner() {
					const arrowElement = options.arrowElement;
					return arrowElement
						? { width: arrowElement.clientWidth || 0, height: arrowElement.clientHeight || 0 }
						: null;
				},
				// Without an Arrow part an empty element is measured.
				async measure(state, place) {
					const realElement = options.arrowElement;
					const element =
						realElement || ownerDocument(state.elements.floating).createElement("div");
					const positionerElement: HTMLElement = state.elements.floating;
					const size = await state.platform.getDimensions(element);
					return place({
						present: realElement != null,
						size,
						popupClient: {
							width: positionerElement.clientWidth,
							height: positionerElement.clientHeight,
						},
					});
				},
			},
			anchorOverflow: async (state, next) =>
				next(await state.platform.detectOverflow(state, { elementContext: "reference" })),
			devicePixelRatio: (state) => getDevicePixelRatio(state.elements.floating),
			sized({ elements, availableWidth, availableHeight }) {
				// Set right away too, so the rest of this computation (a flip after a capped height)
				// measures the constrained popup.
				const positionerElement: HTMLElement = elements.floating;
				positionerElement.style.setProperty(PositionerCssVars.availableWidth, toPx(availableWidth));
				positionerElement.style.setProperty(
					PositionerCssVars.availableHeight,
					toPx(availableHeight),
				);
			},
			// A style read, so it is read only when the transform origin asks.
			popupRtl: (state) =>
				(state.platform.isRTL?.(state.elements.floating) as boolean | undefined) === true,
			last: options.adaptiveOrigin ? adaptiveOriginMiddleware : null,
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
		const positionerElement = elements.floating;
		const win = ownerWindow(positionerElement);
		const duration = win.getComputedStyle(positionerElement).transitionDuration;
		if (duration === "0s" || duration === "") {
			return { x: rawX, y: rawY, data: { sideX: "left", sideY: "top" } };
		}
		const offsetParent = await platform.getOffsetParent?.(positionerElement);
		let container = { width: 0, height: 0 };
		if (strategy === "fixed" && win.visualViewport) {
			container = { width: win.visualViewport.width, height: win.visualViewport.height };
		} else if (offsetParent === win) {
			const doc = ownerDocument(positionerElement);
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
