// The build's per-thread constant, as this folder reads it. The plugin replaces the name with the
// thread's value in each thread's bundle; in this folder it is declared here and named nowhere
// else.

declare const __MAIN_THREAD__: boolean | undefined;

/**
 * `true` where the first frame is drawn: the main thread's bundle. Unset (Node, a plain test), the
 * code counts as the background's.
 */
export const MAIN_THREAD: boolean = typeof __MAIN_THREAD__ !== "undefined" && __MAIN_THREAD__;
