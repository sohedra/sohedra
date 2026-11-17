// The build's per-thread constants, as this folder reads them. The plugin replaces each name with
// the thread's value in the thread's bundle, so a branch on one is decided at build time, also
// across modules. They are declared here and never named elsewhere.

declare const __MAIN_THREAD__: boolean;
declare const __BACKGROUND__: boolean;
declare const __DEV__: boolean;

/** `true` in the main thread's bundle, where the first frame is drawn. */
export const MAIN_THREAD: boolean = __MAIN_THREAD__;
/** `true` in the background thread's bundle, where Svelte and the app run. */
export const BACKGROUND: boolean = __BACKGROUND__;
/** `true` in a development build. */
export const DEV: boolean = __DEV__;
