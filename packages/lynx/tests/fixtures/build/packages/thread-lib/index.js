// A package that reads the thread's constant, as one written for Lynx does. Compiled by the
// build's rules, or its constant stays a free identifier.
export const which = __MAIN_THREAD__ ? "main-thread-lib-branch" : "background-lib-branch";

// A package that fills `fetch` by assigning the free name, as some do: the build keeps the
// assignment as written, and points only the reads of `fetch` on the background elsewhere.
if (typeof fetch !== "function") fetch = function fetchFill() {};
