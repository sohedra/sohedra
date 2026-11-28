import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";

import type { WebTypes } from "../kernel/index.js";
import { closeOnEscape } from "./dismiss-escape.js";
import type { DismissTrigger } from "./dismiss-types.js";

/**
 * A trigger's side of dismissal: Escape while the trigger has focus. `getPopup` is asked on each
 * event: a detached trigger's popup can change.
 */
export function useDismissTrigger(getPopup: () => PopupView<WebTypes>): DismissTrigger {
	const onkeydown = (event: KeyboardEvent) => closeOnEscape(getPopup(), event);
	return { props: { onkeydown } };
}
