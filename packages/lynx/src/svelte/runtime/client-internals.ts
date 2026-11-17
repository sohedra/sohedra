// What the background's compiled components import as Svelte's client runtime: the build points
// `svelte/internal/client` here. Svelte's own, except `$props.id()`.

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/client";

/** The next id `$props.id()` gives on the page. */
let nextId = 1;

/**
 * `$props.id()`: the same ids as Svelte's server gives the first frame, `s1`, `s2`…, in the order the
 * page's components render. Svelte's client gives `c1`… unless it hydrates, which a custom renderer
 * does not, so an element that shows its id would differ from the first frame.
 */
export function props_id(): string {
	return `s${nextId++}`;
}

/** A page starts: its ids start again from `s1`, as the first frame's do. */
export function startPropsIds(): void {
	nextId = 1;
}
