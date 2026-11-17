/** The two threads a Lynx page runs on. */
export type Thread = "background" | "main-thread";

/** The prefix of attributes whose value runs on the main thread: `main-thread:ontap`, `main-thread:ref`. */
export const MAIN_THREAD_PREFIX = "main-thread:";
