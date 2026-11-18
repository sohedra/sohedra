// Every touch of Svelte's internals on a thread: each is a row of `src/svelte/manifest.ts`.

// @ts-expect-error -- Svelte publishes no types for its internal modules; the export below gives this one's.
import { push_renderer } from "svelte/internal/client";

export { startPropsIds } from "./client-internals.ts";
export { CSS_PROPS_HOLDERS } from "./css-props.ts";
export {
	endFirstScreens,
	SCROLL_INDEX_CAP,
	startFirstScreens,
	startingScreens,
} from "./first-screen.ts";
export type { CutScrollIndex } from "./first-screen.ts";
export { listenThrough } from "./events.ts";
export { sourceLocation } from "./locations.ts";
export { signal } from "./signal.ts";
export type { Signal } from "./signal.ts";

/** Makes `renderer` current; returns the function that makes the one before current again. */
export const pushRenderer: (renderer: object | null) => () => void = push_renderer;
