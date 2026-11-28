import { untrack } from "svelte";

import type { PlatformTypes } from "../kernel/index.js";
import type { PopupTriggerData } from "./popup-types.js";

/**
 * What a trigger's registration reads from its popup, and asks of it. The names are a popup
 * store's own, so a trigger part hands its store over as it is.
 */
export interface TriggerRegistrationView<T extends PlatformTypes, Data> {
	registerTrigger(id: string, element: T["element"], data: Data): () => void;
	forwardTriggerData(id: string, element: T["element"] | null, data: Data): void;
	readonly activeTrigger: { isMountedBy(id: string | undefined): boolean };
	/** The trigger reads this popup until the returned leave. */
	joinTrigger(): () => void;
}

/** What a trigger's registration reads, from the options function. */
export interface TriggerRegistrationOptions<T extends PlatformTypes, Data> {
	/** The store the trigger reads now: a handle's store changes when a Root attaches. */
	readonly store: TriggerRegistrationView<T, Data>;
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
	const store = $derived(options().store);
	const id = $derived(options().id);
	const element = $derived(options().element);

	// The popup the trigger reads now is told when the trigger leaves it.
	$effect(() => store.joinTrigger());

	// The element is registered under the trigger's id while it is attached.
	$effect(() => {
		if (!element) {
			return;
		}
		return store.registerTrigger(
			id,
			element,
			untrack(() => options().data),
		);
	});

	// While this trigger owns the mounted popup, its element and data are the popup's.
	$effect(() => {
		const { store, id, element, data } = options();
		if (store.activeTrigger.isMountedBy(id)) {
			store.forwardTriggerData(id, element, data);
		}
	});
}
