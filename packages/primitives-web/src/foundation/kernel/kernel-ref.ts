import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import { webScheduler } from "./kernel-platform.js";

/**
 * An attachment that reports its element to `set`, and `null` when it detaches, unless the ref
 * moved on: another element of the part attached since (a `render` swap), or `get` (the bound ref)
 * holds another element (a replacement attached first, as during an `out:` transition).
 */
export function attachRef<T extends Element>(
	set: (element: T | null) => void,
	get?: () => T | null | undefined,
): Attachment<T> {
	let current: T | null = null;
	return (element) => {
		current = element;
		untrack(() => set(element));
		return () => {
			if (current !== element) {
				return;
			}
			current = null;
			if (!get) {
				set(null);
				return;
			}
			// The bound ref is read a microtask later, as `bind:this` does: a `$bindable` read in a
			// teardown returns what this component last wrote, not the binding's current value.
			webScheduler.microtask(() => {
				// Another element of the same part attached since: the ref is its now.
				if (current !== null) {
					return;
				}
				const bound = get();
				if (bound === element || bound == null) {
					set(null);
				}
			});
		};
	};
}
