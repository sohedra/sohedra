// Dismiss: the web's listeners that close a popup with Escape or a press outside it, and where a press began and ended.
export { attachAncestorsInsideMarker } from "./dismiss-press-target.js";
export type {
	DismissPopupView,
	DismissRootOptions,
	DismissTriggerView,
	DismissView,
} from "./dismiss-types.js";
export { useDismiss, useDismissPopup, useDismissTrigger } from "./dismiss-wiring.svelte.js";
