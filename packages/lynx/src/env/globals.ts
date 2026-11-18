// The build's per-thread constants, as this folder reads them. The plugin replaces each name with
// the thread's value in the thread's bundle, so a branch on one is decided at build time, also
// across modules. They are declared here and never named elsewhere.

declare const __MAIN_THREAD__: boolean;
declare const __BACKGROUND__: boolean;
declare const __DEV__: boolean;

/**
 * `true` in the main thread's bundle, where the first frame is drawn. In markup, `{#if mainThread}`
 * draws a part in the first frame only, and a component in it takes `$props.id()` values of its own
 * (`lynx-m1`…), so the ids after it are the background's.
 */
export const MAIN_THREAD: boolean = __MAIN_THREAD__;
/**
 * `true` in the background thread's bundle, where Svelte and the app run. In markup,
 * `{#if background}` keeps a part off the first frame, and a component in it takes `$props.id()`
 * values of its own (`lynx-b1`…), so the ids after it are the first frame's.
 */
export const BACKGROUND: boolean = __BACKGROUND__;
/** `true` in a development build. */
export const DEV: boolean = __DEV__;
