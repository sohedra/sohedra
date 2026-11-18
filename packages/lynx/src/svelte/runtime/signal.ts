// A value Svelte's effects react to, for state the binding keeps in plain code: Svelte's own
// signal, as `$state` compiles to. `svelte/reactivity`'s `createSubscriber` would do it publicly,
// but its module loads Svelte's URL classes, which extend globals a Lynx thread may lack.

import {
	get as svelteGet,
	set as svelteSet,
	state as svelteState,
	untrack,
	// @ts-expect-error -- Svelte publishes no types for its internal modules; the casts below give these ones'.
} from "svelte/internal/client";

/** A value an effect that reads it re-runs for, when it is written. */
export interface Signal<Value> {
	read(): Value;
	/** Writes the value, also while Svelte runs an effect: the readers re-run at its next flush. */
	write(value: Value): void;
}

// Boundary: Svelte's signal functions, typed by what they do.
const make = svelteState as <Value>(value: Value) => object;
const get = svelteGet as <Value>(signal: object) => Value;
const set = svelteSet as <Value>(signal: object, value: Value) => void;
const untracked = untrack as (run: () => void) => void;

/** A signal holding `value`. */
export function signal<Value>(value: Value): Signal<Value> {
	const source = make(value);
	return {
		read: () => get<Value>(source),
		// Untracked: a write while an effect builds the page is allowed, as from an event.
		write: (next) => untracked(() => set(source, next)),
	};
}
