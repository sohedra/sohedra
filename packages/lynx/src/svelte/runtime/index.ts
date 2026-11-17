// Every touch of Svelte's internals on a thread: each is a row of `src/svelte/manifest.ts`.

// @ts-expect-error -- Svelte publishes no types for its internal modules; the export below gives this one's.
import { push_renderer } from "svelte/internal/client";

export { listenThrough } from "./events.ts";
export { sourceLocation } from "./locations.ts";

/** Makes `renderer` current; returns the function that makes the one before current again. */
export const pushRenderer: (renderer: object | null) => () => void = push_renderer;
