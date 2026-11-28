// Waiting on the browser's and Svelte's own boundaries: the next task, and Svelte's updates after a
// microtask.
import { flushSync } from "svelte";

/**
 * Resolves in the next task: past work a part schedules a task ahead, such as a control restoring
 * its default after a form reset. Wait for a state instead wherever one shows the result.
 */
export function nextTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Applies Svelte's pending updates after a microtask, as `tick()` does outside async mode. */
export async function settle(): Promise<void> {
	await Promise.resolve();
	flushSync();
}
