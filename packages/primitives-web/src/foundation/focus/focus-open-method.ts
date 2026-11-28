// A trigger's record of how it is opening its popup, which the Popup's initial focus reads.

import type {
	InteractionType,
	PopupView,
} from "@sohedra/primitives-core/foundation/popup/index.js";

import { getPointerType, type Props, userAgent, type WebTypes } from "../kernel/index.js";

/**
 * A trigger's record of how it is opening its popup (`openMethod`, read by the Popup's initial
 * focus): the pointer type of the press, or `keyboard` for a click without one. Spread the
 * returned props onto the trigger.
 */
export function useOpenMethod(getPopup: () => PopupView<WebTypes>): Props {
	// Local bookkeeping: the press's pointer type, for the click after it.
	let lastPressType: InteractionType = "";

	function setOpenMethod(type: InteractionType) {
		const popup = getPopup();
		if (!popup.open) {
			// WORKAROUND(ios): a tap's click can come without a pointer type; on iOS it is a touch.
			// Remove when iOS gives every click its pointer type.
			popup.setOpenMethod(type || (userAgent.os.ios ? "touch" : ""));
		}
	}

	return {
		onpointerdown(event: PointerEvent) {
			if (event.defaultPrevented) {
				return;
			}
			lastPressType = getPointerType(event);
			setOpenMethod(lastPressType);
		},
		onclick(event: MouseEvent) {
			if (event.detail === 0) {
				setOpenMethod("keyboard");
				return;
			}
			// A native click is a PointerEvent whose `pointerType` may be empty (synthesised clicks):
			// fall back to the press's pointer type.
			setOpenMethod(getPointerType(event) || lastPressType);
			lastPressType = "";
		},
	};
}
