// The names the build and both threads agree on, each spelled once.

/** The two threads a Lynx page runs on. */
export type Thread = "background" | "main-thread";

/** The prefix of attributes whose value runs on the main thread: `main-thread:ontap`, `main-thread:ref`. */
export const MAIN_THREAD_PREFIX = "main-thread:";

/** The elements whose children may be text: a text node is a `raw-text` element only inside one. */
export const TEXT_CONTAINERS: ReadonlySet<string> = new Set([
	"text",
	"inline-text",
	"x-text",
	"x-inline-text",
]);

/** The package's name, which compiled code and the build name its entries with. */
export const PACKAGE_NAME = "@sohedra/lynx";

/** The module Svelte's compiler imports as each component's custom renderer. */
export const RENDERER_ENTRY: string = `${PACKAGE_NAME}/internal/renderer`;

/** The global where a page's main-thread copy records how to draw its first frame. */
export const FIRST_FRAME_GLOBAL = "__sohedraLynxFirstFrame";

/**
 * Background to main thread: the main thread's global function that
 * `lynx.getNativeApp().callLepusMethod` calls with each patch.
 */
export const PATCH_METHOD = "sohedraLynxPatch";

/**
 * Background to main thread: the main thread's global function that `callLepusMethod` calls with
 * `{ url }` to prepare a lazy bundle the background loaded, its main-thread code and its styles.
 * The engine's callback is the answer. A bundle is prepared for the life of the view, not of a
 * page, so this carries no page and no reload drops it.
 */
export const LAZY_BUNDLE_METHOD = "sohedraLynxPrepareLazyBundle";

/** The params of the main thread's lazy-bundle function. */
export interface LazyBundleParams {
	url: string;
}

/**
 * Main thread to background: the types of the events `lynx.getJSContext().dispatchEvent` sends.
 * Lynx's DevTool counts these events per type and warns about a type sent too often, so what the
 * background is asked to run at the rate of input (events and calls) and what answers or reports
 * back (replies, releases and errors) each have their own.
 */
export const TO_BACKGROUND = {
	events: "@sohedra/lynx:events",
	replies: "@sohedra/lynx:replies",
} as const;
