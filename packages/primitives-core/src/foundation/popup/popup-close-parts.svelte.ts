// The Close parts rendered inside a popup, counted by the popup: a modal popup traps focus only
// with one to leave by.

import { untrack } from "svelte";

/** The Close parts rendered inside a popup. */
export interface ClosePartCount {
	readonly count: number;
	/** Registers a Close part; returns its unregistration. */
	register(): () => void;
}

/** A count of Close parts. Close parts register from an effect, which must not depend on it. */
export function closePartCount(): ClosePartCount {
	let count = $state(0);
	return {
		get count() {
			return count;
		},
		register: () =>
			untrack(() => {
				count += 1;
				return () => {
					count = Math.max(0, untrack(() => count) - 1);
				};
			}),
	};
}

/**
 * Counts a Close part in the popup it is rendered in, while it is mounted; outside a popup
 * (`null`) it counts nowhere. Call once while the Close part initialises: it starts an effect.
 */
export function useClosePart(popup: { readonly closeParts: ClosePartCount } | null): void {
	// The Close part is counted by the Popup it is in while it is mounted.
	$effect(() => popup?.closeParts.register());
}
