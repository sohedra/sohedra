// A closed popup's unmount on the web: once its exit animations finish, unless the store waits.
import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";
import { getAbortSignal, untrack } from "svelte";

import type { WebTypes } from "../kernel/index.js";
import { waitForAnimations } from "../presence/index.js";

/**
 * Unmounts a closed popup once its exit animations finish, unless `preventUnmountOnClose()` was
 * called (the store decides when it waits). `options().element` gives the element whose
 * animations are awaited when it isn't the popup. Call once while the Root initialises: it starts
 * its own effect.
 */
export function usePopupUnmount(
	store: PopupView<WebTypes>,
	options?: () => { readonly element: HTMLElement | null },
): void {
	// Waits for the exit animations of a closed popup, then unmounts it.
	$effect(() => {
		if (!store.awaitingUnmount) {
			return;
		}
		const awaited = options ? options().element : (store.popupElement as HTMLElement | null);
		const signal = getAbortSignal();
		untrack(() => {
			// Without a popup element (its Portal was removed) there is nothing to wait for: the
			// close never completes.
			if (awaited) {
				waitForAnimations(awaited, { signal }, store.unmount);
			}
		});
	});
}
