// Every touch of Svelte's internals on a thread: each is a row of `src/svelte/manifest.ts`.

export { startPropsIds } from "./client-internals.ts";
export { CSS_PROPS_HOLDERS } from "./css-props.ts";
export { withRenderer } from "./current-renderer.ts";
export {
	endFirstScreens,
	SCROLL_INDEX_CAP,
	startFirstScreens,
	startingScreens,
} from "./first-screen.ts";
export type { ListNote } from "./first-screen.ts";
export { listenThrough } from "./events.ts";
export {
	componentInMessage,
	componentOfError,
	componentOfNode,
	sourceLocation,
} from "./locations.ts";
export { signal } from "./signal.ts";
export type { Signal } from "./signal.ts";
