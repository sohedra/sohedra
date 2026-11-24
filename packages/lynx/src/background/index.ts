// Runs on Lynx's background thread: the renderer, the page and the channel to the main thread.

export { fillEngineGaps } from "./engine-gaps.ts";
export type { BackgroundGlobals } from "./globals.ts";
export { mountPage, pageExports } from "./page.ts";
export type { MountPageOptions } from "./page-options.ts";
