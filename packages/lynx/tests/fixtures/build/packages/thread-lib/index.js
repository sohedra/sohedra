// A package that reads the thread's constant, as one written for Lynx does. Compiled by the
// build's rules, or its constant stays a free identifier.
export const which = __MAIN_THREAD__ ? "main-thread-lib-branch" : "background-lib-branch";
