import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";

import type { WebTypes } from "../kernel/index.js";
import { closeOnEscape } from "./dismiss-escape.js";
import type { DismissTrigger } from "./dismiss-types.js";

/**
 * A trigger's side of dismissal: Escape while the trigger has focus. `options().popup` is the
 * popup the trigger reads now, asked on each event: a detached trigger's popup can change.
 */
export function useDismissTrigger(
	options: () => { readonly popup: PopupView<WebTypes> },
): DismissTrigger {
	const onkeydown = (event: KeyboardEvent) => closeOnEscape(options().popup, event);
	return { props: { onkeydown } };
}
