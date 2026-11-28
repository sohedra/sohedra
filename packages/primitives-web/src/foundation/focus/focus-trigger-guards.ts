import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";
import { flushSync } from "svelte";
import { createAttachmentKey } from "svelte/attachments";

import {
	attachRef,
	createChangeEventDetails,
	getTabbableNearElement,
	isOutsideEvent,
	type WebTypes,
} from "../kernel/index.js";
import { focusGuardProps } from "./focus-guard.js";
import type { TriggerFocusGuardProps } from "./focus-types.js";

/**
 * The two focus guards around a trigger whose non-modal popup is portalled elsewhere: they carry
 * Tab from the trigger into the popup, and out of the popup to what follows the trigger. The
 * popup's focus manager holds the other end (its `bridge`).
 *
 * `popup` and `trigger` are read when a guard takes focus, so a trigger may change popups. The
 * part renders `before` and `after` around its element while it owns the open popup.
 */
export function useTriggerFocusGuards(
	popup: () => PopupView<WebTypes>,
	trigger: () => HTMLElement | null,
): TriggerFocusGuardProps {
	// Closes the popup and moves focus on in the direction Tab was going.
	function closeAndFocus(event: FocusEvent, direction: 1 | -1) {
		const guard = event.currentTarget as HTMLElement;
		const view = popup();
		const positionerElement = view.positionerElement;
		view.setOpen(false, createChangeEventDetails(REASONS.focusOut, event, guard));
		flushSync();
		// The close may change the tab order: resolve it now, from the trigger if the guard is gone.
		getTabbableNearElement(
			guard.isConnected ? guard : trigger(),
			direction,
			positionerElement,
		)?.focus();
	}

	return {
		before: {
			...focusGuardProps((event) => closeAndFocus(event, -1)),
			[createAttachmentKey()]: attachRef<HTMLElement>((guard) =>
				popup().guards?.setBeforeTrigger(guard),
			),
		},
		after: {
			...focusGuardProps((event) => {
				const view = popup();
				const positionerElement = view.positionerElement;
				// Tab from the trigger enters the popup; Tab from the popup's end leaves it.
				if (positionerElement && isOutsideEvent(event, positionerElement)) {
					(view.guards?.beforeContent as HTMLElement | null)?.focus();
				} else {
					closeAndFocus(event, 1);
				}
			}),
			[createAttachmentKey()]: attachRef<HTMLElement>((guard) =>
				popup().guards?.setAfterTrigger(guard),
			),
		},
	};
}
