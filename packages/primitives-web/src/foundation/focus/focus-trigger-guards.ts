import { REASONS } from "@sohedra/primitives-core/foundation/kernel";
import { flushSync } from "svelte";

import {
	attachmentProps,
	attachRef,
	createChangeEventDetails,
	getTabbableNearElement,
	isOutsideEvent,
} from "../kernel/index.js";
import { focusGuardProps } from "./focus-guard.js";
import type { TriggerFocusGuards, TriggerFocusGuardsOptions } from "./focus-types.js";

/**
 * The two focus guards around a trigger whose non-modal popup is portalled elsewhere: they carry
 * Tab into the popup and out of it to what follows the trigger (the popup's focus manager holds
 * the other end). The options are read when a guard takes focus, so the popup may change.
 */
export function useTriggerFocusGuards(
	options: () => TriggerFocusGuardsOptions,
): TriggerFocusGuards {
	// Closes the popup and moves focus on in the direction Tab was going.
	function closeAndFocus(event: FocusEvent, direction: 1 | -1) {
		const guard = event.currentTarget as HTMLElement;
		const popup = options().popup;
		const positionerElement = popup.positionerElement;
		popup.setOpen(false, createChangeEventDetails(REASONS.focusOut, event, guard));
		flushSync();
		// The close may change the tab order: resolve it now, from the trigger if the guard is gone.
		getTabbableNearElement(
			guard.isConnected ? guard : options().trigger,
			direction,
			positionerElement,
		)?.focus();
	}

	return {
		guardBefore: {
			...focusGuardProps((event) => closeAndFocus(event, -1)),
			...attachmentProps(
				attachRef<HTMLElement>((guard) => options().popup.guards?.setGuardBeforeTrigger(guard)),
			),
		},
		guardAfter: {
			...focusGuardProps((event) => {
				const popup = options().popup;
				const positionerElement = popup.positionerElement;
				// Tab from the trigger enters the popup; Tab from the popup's end leaves it.
				if (positionerElement && isOutsideEvent(event, positionerElement)) {
					(popup.guards?.guardBeforeContent as HTMLElement | null)?.focus();
				} else {
					closeAndFocus(event, 1);
				}
			}),
			...attachmentProps(
				attachRef<HTMLElement>((guard) => options().popup.guards?.setGuardAfterTrigger(guard)),
			),
		},
	};
}
