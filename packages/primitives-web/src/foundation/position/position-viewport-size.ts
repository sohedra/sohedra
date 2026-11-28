import { getComputedStyle } from "../kernel/index.js";
import { PopupSizeCssVariables, PositionerCssVariables } from "./position-attributes.js";

export interface Dimensions {
	width: number;
	height: number;
}

/** An element's computed size, or its offset size when the two disagree. */
export function getCssDimensions(element: HTMLElement): Dimensions {
	const css = getComputedStyle(element);
	let width = parseFloat(css.width) || 0;
	let height = parseFloat(css.height) || 0;
	if (Math.round(width) !== element.offsetWidth || Math.round(height) !== element.offsetHeight) {
		width = element.offsetWidth;
		height = element.offsetHeight;
	}
	return { width, height };
}

function override(element: HTMLElement | null, property: string, value: string): () => void {
	if (!element) {
		return () => {};
	}
	const original = element.style.getPropertyValue(property);
	element.style.setProperty(property, value);
	return () => element.style.setProperty(property, original);
}

/** The size variables of the popup or of its Positioner, as declarations. */
export function sizeVars(
	element: "popup" | "positioner",
	size: Dimensions | "auto" | "max-content",
) {
	const width = typeof size === "string" ? size : `${size.width}px`;
	const height = typeof size === "string" ? size : `${size.height}px`;
	const [widthVariable, heightVariable] =
		element === "popup"
			? [PopupSizeCssVariables.popupWidth, PopupSizeCssVariables.popupHeight]
			: [PositionerCssVariables.positionerWidth, PositionerCssVariables.positionerHeight];
	return `${widthVariable}: ${width}; ${heightVariable}: ${height}`;
}

/**
 * The popup's natural size for its current content: measured with its size variables, the
 * Positioner's limits, its own transform and the Viewport containers' animations out of the way,
 * all restored at once.
 */
export function measurePopupSize(
	popup: HTMLElement,
	positioner: HTMLElement,
	anchoringCss: string,
	currentContainer: HTMLElement | null,
	previousContainer: HTMLElement | null,
): Dimensions {
	const restores = [
		...anchoringCss
			.split("; ")
			.filter(Boolean)
			.map((declaration) => {
				const [property, value] = declaration.split(": ");
				return override(popup, property, value);
			}),
		override(popup, PopupSizeCssVariables.popupWidth, "auto"),
		override(popup, PopupSizeCssVariables.popupHeight, "auto"),
		override(popup, "position", "static"),
		override(popup, "transform", "none"),
		override(popup, "scale", "1"),
		override(positioner, PositionerCssVariables.availableWidth, "max-content"),
		override(positioner, PositionerCssVariables.availableHeight, "max-content"),
		override(positioner, PositionerCssVariables.positionerWidth, "max-content"),
		override(positioner, PositionerCssVariables.positionerHeight, "max-content"),
		// Measured without the containers' own animations.
		override(currentContainer, "animation", "none"),
		override(currentContainer, "transition", "none"),
		override(previousContainer, "display", "none"),
	];
	const dimensions = getCssDimensions(popup);
	for (const restore of restores.reverse()) {
		restore();
	}
	return dimensions;
}
