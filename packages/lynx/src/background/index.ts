// Runs on Lynx's background thread: the renderer, the page and the channel to the main thread.
// Also `@sohedra/lynx/internal/page` on the background, which starts the page.

export { startPage } from "./page.ts";
export type { StartPageOptions } from "./page.ts";
