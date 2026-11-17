// Stands in, in the build tests, for the module that the main thread's compiled components import
// as Svelte's server internals. The tests build; nothing runs it.

export * from "svelte/internal/server";
