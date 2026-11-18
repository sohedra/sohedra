// What the main thread's compiled components import as Svelte's server runtime: the build points
// `svelte/internal/server` here. Svelte's own, unchanged.

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/server";
