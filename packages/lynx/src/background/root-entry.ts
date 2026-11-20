// `@sohedra/lynx` on the background: the page, its layers, its root and static copies, main-thread
// refs and the calls between the threads. Its main-thread side, which the page's entry and its
// main-thread code import, is ../first-frame/root-entry.ts.

export { runOnBackground, runOnMainThread } from "./functions/calls.ts";
export { mainThreadRef } from "./functions/refs.ts";
export type { MainThreadRef } from "./functions/refs.ts";
export { mount, unmount } from "./layers.ts";
export type { MountOptions } from "./layers.ts";
export { mountPage } from "./page.ts";
export type { MountPageOptions } from "./page-options.ts";
export type { ErrorContext, ErrorHandler } from "./errors.ts";
export { reportError } from "./report.ts";
export { root } from "./root.ts";
export { createStaticCopy } from "./static-copy.ts";
export type { StaticCopy, StaticCopyOptions } from "./static-copy.ts";
