// Which thread a bundle is, as values: `import { mainThread, background, dev } from
// "@sohedra/lynx/env"`. Each is decided when the app is built, so the branch it guards is dropped
// from the thread that never runs it. `{#if background}` keeps a part of the markup off the first
// frame.

/** `true` in the main thread's bundle, where the first frame is drawn. */
export { MAIN_THREAD as mainThread } from "./globals.ts";
/** `true` in the background thread's bundle, where Svelte and the app run. */
export { BACKGROUND as background } from "./globals.ts";
/** `true` in a development build. */
export { DEV as dev } from "./globals.ts";
