// A closed popup's unmount on the web: once its exit animations finish, unless the store waits.
import { getAbortSignal, untrack } from "svelte";

import { waitForAnimations } from "../presence/index.js";

/** What `usePopupUnmount` reads of its store and asks of it. */
export interface PopupUnmountView {
	/** Whether a closed popup is waiting for its exit animations before unmounting. */
	readonly awaitingUnmount: boolean;
	/** The popup element, whose exit animations are awaited by default. */
	readonly popupElement: Element | null;
	/** Ends the closing phase. */
	unmount(): void;
}

/**
 * Unmounts a closed popup once its exit animations finish, unless `preventUnmountOnClose()` was
 * called (the store decides when it waits). `element` gives the element whose animations are
 * awaited when it isn't the popup. Call once while the Root initialises: it starts its own effect.
 */
export function usePopupUnmount(
	store: PopupUnmountView,
	element: () => HTMLElement | null = () => store.popupElement as HTMLElement | null,
): void {
	// Waits for the exit animations of a closed popup, then unmounts it.
	$effect(() => {
		if (!store.awaitingUnmount) {
			return;
		}
		const awaited = element();
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
