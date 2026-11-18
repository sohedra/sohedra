// `@sohedra/lynx` on the background: main-thread refs and the calls between the threads. Its
// main-thread side, which the page's main-thread code imports, is ../first-frame/root-entry.ts.

export { runOnBackground, runOnMainThread } from "./functions/calls.ts";
export { mainThreadRef } from "./functions/refs.ts";
export type { MainThreadRef } from "./functions/refs.ts";
