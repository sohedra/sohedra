/** The two threads a Lynx page runs on. */
export type Thread = "background" | "main-thread";

/** The prefix of attributes whose value runs on the main thread: `main-thread:ontap`, `main-thread:ref`. */
export const MAIN_THREAD_PREFIX = "main-thread:";

/** The package's name, which compiled code and the build name its entries with. */
export const PACKAGE_NAME = "@sohedra/lynx";

/** The module Svelte's compiler imports as each component's custom renderer. */
export const RENDERER_ENTRY: string = `${PACKAGE_NAME}/internal/renderer`;

/** The global where a page's main-thread copy records how to draw its first frame. */
export const FIRST_FRAME_GLOBAL = "__svelteLynxFirstFrame";
