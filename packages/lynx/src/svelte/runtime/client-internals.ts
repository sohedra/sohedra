// What the background's compiled components import as Svelte's client runtime: the build points
// `svelte/internal/client` here. Svelte's own, except `$props.id()`.

import { PROPS_ID_PREFIX } from "../../wire/index.ts";
import { svelteSlot } from "./globals.ts";

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/client";

/**
 * `$props.id()`: the same ids as Svelte's server gives the first frame, `lynx-s1`, `lynx-s2`…, in
 * the order the page's components render. Svelte's client gives `c1`… unless it hydrates, which a
 * custom renderer does not. The count is Svelte's own, on the global object, so every copy of this
 * module in the page (a lazy bundle's) gives ids of one sequence.
 */
export function props_id(): string {
	const slot = svelteSlot();
	const id = slot.uid ?? 1;
	slot.uid = id + 1;
	return `${PROPS_ID_PREFIX}-s${id}`;
}

/** A page starts: its ids start again from the first, as the first frame's do. */
export function startPropsIds(): void {
	svelteSlot().uid = 1;
}
