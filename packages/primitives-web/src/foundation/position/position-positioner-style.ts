import type {
	OriginOffset,
	PositionState,
} from "@sohedra/primitives-core/foundation/position/index.js";

import { PositionerCssVars } from "./position-attributes.js";
import { getDevicePixelRatio, type Measured, toPx } from "./position-positioner-middleware.js";

function formatOrigin(offset: OriginOffset) {
	if (offset.percent !== undefined && offset.px !== undefined) {
		return `calc(${offset.percent}% + ${offset.px}px)`;
	}
	return offset.percent !== undefined ? `${offset.percent}%` : toPx(offset.px ?? 0);
}

/** The `--transform-origin` value of a measured origin. */
export function formatTransformOrigin(origin: { x: OriginOffset; y: OriginOffset }): string {
	return `${formatOrigin(origin.x)} ${formatOrigin(origin.y)}`;
}

/**
 * The Positioner element's inline style for a position: placement (a transform, or the far
 * edges when a Viewport asks for them), the CSS variables, invisibility until it is positioned,
 * and no pointer input while `inert`.
 */
export function positionerStyle(
	position: PositionState,
	element: HTMLElement | null,
	positionMethod: "absolute" | "fixed",
	layoutStyle: string | undefined,
	inert: boolean,
): string {
	const declarations: string[] = [];
	if (!position.isPositioned) {
		// Until the first position of this opening, render at the origin, invisible, and fixed so
		// `autofocus` can't scroll the page.
		declarations.push("position: fixed", "top: 0px", "left: 0px");
	} else {
		if (position.sides) {
			// Placed from the edges that keep the popup's anchored side fixed while a Viewport
			// resizes it.
			declarations.push(
				`position: ${positionMethod}`,
				`${position.sides.sideX}: ${position.x}px`,
				`${position.sides.sideY}: ${position.y}px`,
			);
		} else {
			declarations.push(`position: ${positionMethod}`, "left: 0px", "top: 0px");
			declarations.push(`transform: translate(${position.x}px, ${position.y}px)`);
			if (element && getDevicePixelRatio(element) >= 1.5) {
				declarations.push("will-change: transform");
			}
		}
	}
	// A kept-mounted popup keeps the last measured variables while closed.
	const measured: Measured = position;
	const px = (value: number | undefined, fallback: string) =>
		value === undefined ? fallback : toPx(value);
	// Seeded so `max-height: var(--available-height)` resolves on the first pass.
	declarations.push(
		`${PositionerCssVars.availableWidth}: ${px(measured.availableWidth, "100vw")}`,
		`${PositionerCssVars.availableHeight}: ${px(measured.availableHeight, "100vh")}`,
	);
	if (measured.anchorWidth !== undefined) {
		declarations.push(`${PositionerCssVars.anchorWidth}: ${toPx(measured.anchorWidth)}`);
	}
	if (measured.anchorHeight !== undefined) {
		declarations.push(`${PositionerCssVars.anchorHeight}: ${toPx(measured.anchorHeight)}`);
	}
	const origin = measured.transformOrigin;
	if (origin) {
		declarations.push(`${PositionerCssVars.transformOrigin}: ${formatTransformOrigin(origin)}`);
	}
	if (!position.isPositioned) {
		declarations.push("opacity: 0");
	}
	if (layoutStyle) {
		declarations.push(layoutStyle);
	}
	if (inert) {
		declarations.push("pointer-events: none");
	}
	return declarations.join("; ");
}

/** An Arrow's inline style: placed at the computed arrow offsets. */
export function arrowStyle(arrow: PositionState["arrow"]): string {
	const declarations = ["position: absolute"];
	if (arrow?.y != null) {
		declarations.push(`top: ${arrow.y}px`);
	}
	if (arrow?.x != null) {
		declarations.push(`left: ${arrow.x}px`);
	}
	return declarations.join("; ");
}

/**
 * The style of the layer a modal popup puts over the page: fixed, over the whole viewport, with
 * `cutout` (the trigger) cut out, so the trigger stays pressable.
 */
export function internalBackdropStyle(cutout: Element | null): string {
	const base = "position: fixed; inset: 0px; user-select: none; -webkit-user-select: none";
	if (!cutout) {
		return base;
	}
	const rect = cutout.getBoundingClientRect();
	return `${base}; clip-path: polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
}
