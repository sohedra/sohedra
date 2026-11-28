import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";

/**
 * Layout a Viewport measures for its Popup and Positioner (size variables, pinned edges), and
 * whether the Positioner places the popup from its far edges. The Positioner owns it; the Popup
 * and Positioner put the styles in their declarative `style`, so nothing is written to an
 * element's style outside a synchronous measurement.
 */
export class PopupLayoutState {
	popupStyle = $state("");
	positionerStyle = $state("");
	adaptiveOrigin = $state(false);
}

export const PopupLayoutContext = defineContext<PopupLayoutState>(
	"PopupLayoutContext",
	"Viewport parts must be placed within a Positioner.",
);
