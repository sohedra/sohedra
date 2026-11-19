// The renderer Svelte's runtime draws with and listens through: the one current when it is called.

// @ts-expect-error -- Svelte publishes no types for its internal modules; the casts below give these ones'.
import { pop_renderer, push_renderer } from "svelte/internal/client";

// Boundary: Svelte's functions, typed by what they do.
const push = push_renderer as (renderer: object | null) => object | null;
const pop = pop_renderer as (previous: object | null) => void;

/** Runs `run` with `renderer` current, and makes the one before current again after. */
export function withRenderer<T>(renderer: object | null, run: () => T): T {
	const previous = push(renderer);
	try {
		return run();
	} finally {
		pop(previous);
	}
}
