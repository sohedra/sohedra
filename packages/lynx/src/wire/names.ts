/** The two threads a Lynx page runs on. */
export type Thread = "background" | "main-thread";

/** The prefix of attributes whose value runs on the main thread: `main-thread:ontap`, `main-thread:ref`. */
export const MAIN_THREAD_PREFIX = "main-thread:";

/** The package's name, which compiled code and the build name its entries with. */
export const PACKAGE_NAME = "@sohedra/lynx";

/** The module Svelte's compiler imports as each component's custom renderer. */
export const RENDERER_ENTRY: string = `${PACKAGE_NAME}/internal/renderer`;

/** The module whose size the page's own size comes from; each thread resolves its own. */
export const WINDOW_SIZE_ENTRY: string = `${PACKAGE_NAME}/internal/window-size`;
