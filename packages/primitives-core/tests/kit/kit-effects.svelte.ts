// Effects in a test: `track`, an effect the test watches, and `root`, an effect root for code that
// creates effects of its own. Both are destroyed when the test finishes.
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

/**
 * Runs `fn` inside an `$effect.root`, as a component's script runs: the effects it creates (a
 * `watch`, a `follow`) belong to the root and first run at the next `flushSync()`. Returns the
 * root's destroy, which also runs when the test finishes; destroying twice does nothing more.
 */
export function root(fn: () => void): () => void {
	const destroy = $effect.root(fn);
	onTestFinished(destroy);
	return destroy;
}
