import { defineContext } from "@sohedra/primitives-core/foundation/kernel";

/**
 * Layout a Viewport measures for its Popup and Positioner (size variables, pinned edges), and
 * whether the Positioner places the popup from its far edges. The Positioner owns it; the Popup
 * and Positioner put the styles in their declarative `style`, so nothing is written to an
 * element's style outside a synchronous measurement.
 */
export class PopupLayoutStore {
	#popupStyle = $state("");
	#positionerStyle = $state("");
	#adaptiveOrigin = $state(false);

	/** The Popup's size variables and pinned edges. */
	get popupStyle(): string {
		return this.#popupStyle;
	}

	/** The Positioner's size variables. */
	get positionerStyle(): string {
		return this.#positionerStyle;
	}

	/** Whether the Positioner places the popup from its far edges. */
	get adaptiveOrigin(): boolean {
		return this.#adaptiveOrigin;
	}

	/** A Viewport measured the Popup's style. */
	setPopupStyle = (style: string): void => {
		this.#popupStyle = style;
	};

	/** A Viewport measured the Positioner's style. */
	setPositionerStyle = (style: string): void => {
		this.#positionerStyle = style;
	};

	/** Whether the Positioner places the popup from its far edges from now on. */
	setAdaptiveOrigin = (value: boolean): void => {
		this.#adaptiveOrigin = value;
	};
}

/** The layout of the Positioner a Viewport sits in: the shared Positioner part sets its store. */
export const PopupLayoutContext = defineContext<PopupLayoutStore>("Positioner");
