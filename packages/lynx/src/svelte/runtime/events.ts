// What `svelte/events` resolves to on the background (the build points it here). Svelte's `on()`
// listens through the renderer that is current when it is called, and Svelte clears the current
// renderer outside its effects, after an `{#await}` block settles too. So this `on()` makes the
// page's renderer current while it calls Svelte's, and while it stops listening: `on()` listens
// through the renderer wherever it is called, in a handler, a timer or code after an `await`.
// With no page running (module-level code, before `mountPage`), a renderer that hands the call to
// the target is current instead: with none, Svelte would treat the target as a DOM node and read
// the listener's first argument as a DOM event.

import { on as svelteOn } from "svelte/events";

import { withRenderer } from "./current-renderer.ts";

/** A target of `on()` that keeps its own listeners: the host, or the page's root before a page. */
interface Target {
	addEventListener(type: string, handler: unknown, options?: unknown): void;
	removeEventListener(type: string, handler: unknown, options?: unknown): void;
}

/** The renderer while no page runs: it hands each listener to the target, as given. */
const passThrough = {
	addEventListener: (target: Target, type: string, handler: unknown, options?: unknown): void =>
		target.addEventListener(type, handler, options),
	removeEventListener: (target: Target, type: string, handler: unknown, options?: unknown): void =>
		target.removeEventListener(type, handler, options),
};

/** The renderer `on()` listens through: the page's, or the pass-through one when none runs. */
let pageRenderer: object = passThrough;

/** Makes `renderer` the one `on()` listens through; `null` when no page runs. */
export function listenThrough(renderer: object | null): void {
	pageRenderer = renderer ?? passThrough;
}

function listen(...args: Parameters<typeof svelteOn>): () => void {
	const renderer = pageRenderer;
	const off = withRenderer(renderer, () => svelteOn(...args));
	return () => withRenderer(renderer, off);
}

/** Svelte's `on()`, through the page's renderer. */
// Boundary: Svelte's `on` is overloaded per target; this passes every overload's arguments through.
export const on: typeof svelteOn = listen as typeof svelteOn;
