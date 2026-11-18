// What the background's compiled components import as Svelte's client runtime: the build points
// `svelte/internal/client` here. Svelte's own, except `$props.id()`.

import { PROPS_ID_PREFIX } from "../../wire/index.ts";
import { svelteSlot } from "./globals.ts";

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/client";

/** The shared count when this page started: its ids are counted from there. */
let base = 1;

/**
 * `$props.id()`: the same ids as Svelte's server gives the first frame, `lynx-s1`, `lynx-s2`…, in
 * the order the page's components render. Svelte's client gives `c1`… unless it hydrates, which a
 * custom renderer does not. The count is Svelte's own on the global object, shared by every runtime
 * in the realm (a lazy bundle's copy of this module, another page of a Lynx group), and is never set
 * back: each page counts from the base it took when it started.
 */
export function props_id(): string {
	const slot = svelteSlot();
	const count = slot.uid ?? 1;
	slot.uid = count + 1;
	return `${PROPS_ID_PREFIX}-s${count - base + 1}`;
}

/** A page starts: its ids start again from the first, as the first frame's do. */
export function startPropsIds(): void {
	const slot = svelteSlot();
	base = slot.uid ??= 1;
}
