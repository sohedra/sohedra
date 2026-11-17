// Stands in, in the build tests, for the module that the background's compiled components import
// as Svelte's client internals. The tests build; nothing runs it.

export * from "svelte/internal/client";
