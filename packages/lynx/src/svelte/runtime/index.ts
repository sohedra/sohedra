// Every touch of Svelte's internals on a thread: each is a row of `src/svelte/manifest.ts`.

// @ts-expect-error -- Svelte publishes no types for its internal modules; the export below gives this one's.
import { push_renderer } from "svelte/internal/client";

export { sourceLocation } from "./locations.ts";

/** Makes `renderer` current; returns the function that makes the one before current again. */
export const pushRenderer: (renderer: object | null) => () => void = push_renderer;

/**
 * Keeps `renderer` current outside Svelte's effects as well, until the function it returns is
 * called. Svelte's `on()` reads the current renderer when it is called, and an effect puts back the
 * renderer it found: so `on()` in an event handler, a timer or code after an `await` listens
 * through the renderer, not through the DOM, which Lynx's background does not have.
 *
 * Svelte's experimental async mode clears the current renderer after a component's own `await`,
 * until the next effect or event: `on()` called in that gap takes the DOM's path.
 */
export function keepRenderer(renderer: object): () => void {
	return pushRenderer(renderer);
}
