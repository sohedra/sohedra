import { untrack } from "svelte";

/**
 * Calls a user callback without tracking what it reads, so a callback never becomes a dependency
 * of the effect or derived that happens to call it.
 */
export function callUser<Args extends unknown[], R>(
	callback: ((...args: Args) => R) | undefined | null,
	...args: Args
): R | undefined {
	if (!callback) {
		return undefined;
	}
	return untrack(() => callback(...args));
}
