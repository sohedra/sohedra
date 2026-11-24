// Every touch of Svelte's internals on a thread: each is a row of `src/svelte/manifest.ts`.

export { startPropsIds } from "./client-internals.ts";
export { CSS_PROPS_HOLDERS, isCssPropsHolder } from "./css-props.ts";
export { withRenderer } from "./current-renderer.ts";
export {
	endInitialRows,
	SCROLL_INDEX_CAP,
	startInitialRows,
	startingInitialRows,
} from "./initial-rows.ts";
export { listenThrough } from "./events.ts";
export {
	componentInMessage,
	componentOfError,
	componentOfNode,
	sourceLocation,
} from "./locations.ts";
export { signal } from "./signal.ts";
export type { Signal } from "./signal.ts";
