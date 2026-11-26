import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import { webScheduler } from "./kernel-platform.js";

/**
 * An attachment that reports its element to `set`, and `null` when it detaches, unless the ref
 * has moved on: another element of the same part attached in the meantime (a `render` swap
 * attaches the new element before the old one detaches), or `get` (the bound ref) holds a
 * different element (a replacement part attached first, as when the old one plays an `out:`
 * transition).
 *
 * With `get`, the bound ref is read a microtask after the element detaches and compared with the
 * element this attachment captured, as Svelte's own `bind:this` does. A `$bindable` prop read
 * inside a teardown returns the value its own component last wrote, which is that element even
 * when a replacement has bound another one since; a microtask later it reads the binding's
 * current value.
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
				untrack(() => set(null));
				return;
			}
			webScheduler.microtask(() => {
				// Another element of the same part attached since: the ref is its now.
				if (current !== null) {
					return;
				}
				const bound = untrack(get);
				if (bound === element || bound == null) {
					untrack(() => set(null));
				}
			});
		};
	};
}
