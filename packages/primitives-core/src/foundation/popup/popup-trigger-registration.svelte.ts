import { untrack } from "svelte";

import type { PlatformTypes } from "../kernel/index.js";
import type { PopupTriggerData } from "./popup-types.js";
import type { PopupView } from "./popup-view.js";

/** What a trigger's registration reads, from the options function. */
export interface TriggerRegistrationOptions<T extends PlatformTypes, Data> {
	/** The popup the trigger reads now: a handle's store changes when a Root attaches. */
	readonly popup: PopupView<T>;
	readonly id: string;
	/** The trigger element, once attached. */
	readonly element: T["element"] | null;
	/** What the trigger forwards to the popup while it owns it (its payload and options). */
	readonly data: Data;
}

/**
 * Registers a trigger with its popup while it is attached: its element under its id, in
 * whichever store it currently reads, and, while it owns the mounted popup, its element and data
 * as the popup's. Call once while the trigger part initialises: it starts its own effects.
 */
export function useTriggerRegistration<
	T extends PlatformTypes,
	Data extends PopupTriggerData<unknown>,
>(options: () => TriggerRegistrationOptions<T, Data>): void {
	// Compared by value: the trigger registers again only when one of these changes, not when the
	// data it forwards does (the effect below forwards that).
	const popup = $derived(options().popup);
	const id = $derived(options().id);
	const element = $derived(options().element);

	// The popup the trigger reads now is told when the trigger leaves it.
	$effect(() => popup.joinTrigger());

	// The element is registered under the trigger's id while it is attached.
	$effect(() => {
		if (!element) {
			return;
		}
		return popup.registerTrigger(
			id,
			element,
			untrack(() => options().data),
		);
	});

	// While this trigger owns the mounted popup, its element and data are the popup's. The payload
	// lands an update after the trigger change on purpose: in the same update, async content that
	// waits on the payload would hold the whole trigger change until it loads.
	$effect(() => {
		const { popup, id, element, data } = options();
		if (popup.activeTrigger.isMountedBy(id)) {
			popup.forwardTriggerData(id, element, data);
		}
	});
}
