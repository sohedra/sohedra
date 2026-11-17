// What `svelte/events` resolves to on the background (the build points it here). Svelte's `on()`
// listens through the renderer that is current when it is called, and Svelte clears the current
// renderer outside its effects, after an `{#await}` block settles too. So this `on()` makes the
// page's renderer current while it calls Svelte's, and while it stops listening: `on()` listens
// through the renderer wherever it is called, in a handler, a timer or code after an `await`.

import { on as svelteOn } from "svelte/events";
// @ts-expect-error -- Svelte publishes no types for its internal modules; the cast below gives this one's.
import { push_renderer } from "svelte/internal/client";

const pushRenderer = push_renderer as (renderer: object | null) => () => void;

/** The renderer `on()` listens through; null when no page runs, and then `on()` is Svelte's. */
let pageRenderer: object | null = null;

/** Makes `renderer` the one `on()` listens through, or none. */
export function listenThrough(renderer: object | null): void {
	pageRenderer = renderer;
}

/** Runs `run` with `renderer` current. */
function withRenderer<T>(renderer: object, run: () => T): T {
	const pop = pushRenderer(renderer);
	try {
		return run();
	} finally {
		pop();
	}
}

function listen(...args: Parameters<typeof svelteOn>): () => void {
	const renderer = pageRenderer;
	if (renderer === null) return svelteOn(...args);
	const off = withRenderer(renderer, () => svelteOn(...args));
	return () => withRenderer(renderer, off);
}

/** Svelte's `on()`, through the page's renderer. */
// Boundary: Svelte's `on` is overloaded per target; this passes every overload's arguments through.
export const on: typeof svelteOn = listen as typeof svelteOn;
