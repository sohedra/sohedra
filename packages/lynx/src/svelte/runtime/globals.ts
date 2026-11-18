// The globals Svelte's runtime keeps on a thread, as this folder's code reads them.

/** What Svelte keeps on the global object, shared by every copy of its runtime in the page. */
interface SvelteGlobals {
	__svelte?: { uid?: number };
}

// Boundary: the global object has no types for Svelte's slot; this is the one place it is typed.
const scope = globalThis as unknown as SvelteGlobals;

/** Svelte's slot on the global object, made when first needed. */
export function svelteSlot(): { uid?: number } {
	return (scope.__svelte ??= {});
}
