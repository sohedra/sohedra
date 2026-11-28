// `track`: an effect a test watches, for what a store's reactive reads re-run.
import { flushSync } from "svelte";
import { onTestFinished } from "vitest";

/** What an effect `track` runs has returned so far. */
export interface Tracked<T> {
	/** The value of each run, the first run first. */
	readonly runs: readonly T[];
}

/**
 * Runs `fn` in an effect of its own `$effect.root`: once now, and again after a `flushSync()`
 * whenever something it read has changed. Records each run's value. The root is destroyed when
 * the test finishes.
 */
export function track<T>(fn: () => T): Tracked<T> {
	const runs: T[] = [];
	const destroy = $effect.root(() => {
		$effect(() => {
			runs.push(fn());
		});
	});
	onTestFinished(destroy);
	flushSync();
	return { runs };
}
