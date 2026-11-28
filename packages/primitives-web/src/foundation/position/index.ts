// Position: the Positioner on the web: the shared Positioner, Arrow and Viewport parts, the page scroll lock of a modal popup, the styling hooks they write, and the positioning types of an anchored popup's props.
export { default as AnchoredArrow } from "./position-anchored-arrow.svelte";
export { default as AnchoredPositioner } from "./position-anchored-positioner.svelte";
export { useAnchoredScrollLock } from "./position-anchored-scroll-lock.svelte.js";
export { default as AnchoredViewport } from "./position-anchored-viewport.svelte";
export {
	PopupSizeCssVariables,
	PositionerCssVariables,
	ViewportDataAttributes,
	viewportStateMapping,
} from "./position-attributes.js";
export type {
	Align,
	Boundary,
	CollisionAvoidance,
	OffsetFunction,
	Padding,
	PositionerAnchor,
	Side,
} from "./position-types.js";
