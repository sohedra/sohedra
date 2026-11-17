// What the background's compiled components import as Svelte's client runtime: the build points
// `svelte/internal/client` here. Svelte's own, unchanged.

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/client";
