// Which thread a bundle is, as values: `import { mainThread, background, dev } from
// "@sohedra/lynx/env"`. Each is decided when the app is built, so the branch it guards is dropped
// from the thread that never runs it. `{#if background}` keeps a part of the markup off the first
// frame.

export { MAIN_THREAD as mainThread, BACKGROUND as background, DEV as dev } from "./globals.ts";
