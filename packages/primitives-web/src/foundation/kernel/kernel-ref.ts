import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

/**
 * An attachment that reports its element to `set`, and `null` when it detaches, unless the ref
 * has moved on: another element of the same part attached in the meantime (a `render` swap
 * attaches the new element before the old one detaches), or `get` (the bound ref) already holds a
 * different element (a replacement part attached first, as when the old one plays an `out:`
 * transition).
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
			const bound = get ? untrack(get) : element;
			if (bound === element || bound == null) {
				untrack(() => set(null));
			}
		};
	};
}
