import { DEV } from "esm-env";
import { untrack } from "svelte";

import type { Bound } from "./kernel-bound.js";
import { error } from "./kernel-log.js";
import { callUser } from "./kernel-user-callback.js";
import { watch } from "./kernel-watch.svelte.js";

/** What a controllable value is given once. */
export interface ControllableDeps<T> {
	/** The `$bindable` prop: the value while it isn't `undefined`. */
	readonly source: Bound<T | undefined>;
	/** The default when the source is `undefined`. Read untracked, except by the dev warning. */
	default: () => T;
	/** The component name in warnings, e.g. `Switch`. */
	name: string;
	/** The state name in warnings, e.g. `checked`. */
	state: string;
}

interface Cancelable {
	readonly isCanceled: boolean;
}

/**
 * A value controlled through a `$bindable` prop or kept locally, with Svelte semantics: no mode
 * lock, since a binding already merges both modes and a parent's `undefined` falls back to the
 * local value. Writes call the change callback first and skip the write when it cancels.
 */
export class Controllable<T> {
	#source: Bound<T | undefined>;
	#options: ControllableDeps<T>;
	// Raw: a value is kept as given, never deep-proxied, so an object stays `===` to the one the
	// parts compare it with (a tab's or a radio's value).
	#local = $state.raw() as T;
	#initiallyUncontrolled: boolean;
	/**
	 * The object last written through the source and the `$state` proxy it reads back instead.
	 * While the source reads back that proxy, the written object is the value; for an array,
	 * `items` maps each item the proxy made back to the written one.
	 */
	#echo: { readBack: unknown; written: T; items: Map<unknown, unknown> | null } | null = null;

	/** The current value: the source's, or the local one while the source is `undefined`. */
	readonly current: T = $derived(this.#read());

	constructor(deps: ControllableDeps<T>) {
		this.#source = deps.source;
		this.#options = deps;
		const given = untrack(() => deps.source.value);
		this.#initiallyUncontrolled = given === undefined;
		const initial = given === undefined ? untrack(deps.default) : given;
		this.#local = initial;
		if (given === undefined && initial !== undefined) {
			// Like a native `bind:checked`, an unset binding takes the initial value. An `undefined`
			// initial value is never written.
			this.#writeSource(initial, undefined);
		}
	}

	#read(): T {
		const controlled = this.#source.value;
		if (controlled === undefined) {
			return this.#local;
		}
		const echo = this.#echo;
		if (echo === null || !Object.is(controlled, echo.readBack)) {
			return controlled;
		}
		if (!Array.isArray(controlled)) {
			return echo.written;
		}
		// An array is read through the proxy, so an item pushed or removed in place is seen (and kept
		// by the next write); an item the proxy made of a written object reads as that object.
		const items = controlled.map((item: unknown) => echo.items?.get(item) ?? item);
		return sameItems(items, echo.written as unknown[]) ? echo.written : (items as T);
	}

	/**
	 * Writes `next` to the source and reads it back. An object that comes back as another object
	 * (neither `next` nor what the source held before, which a declining binding keeps) is the
	 * proxy a user's `$state` made of it: it reads as `next` until the source changes again.
	 */
	#writeSource(next: T, before: unknown) {
		this.#source.value = next;
		const readBack = untrack(() => this.#source.value);
		this.#echo =
			isObject(next) && isObject(readBack) && readBack !== next && readBack !== before
				? { readBack, written: next, items: echoedItems(next, readBack) }
				: null;
	}

	/**
	 * Proposes `next`: calls `onChange(next, details)` first, and returns `false` when it canceled
	 * or the source declined the write, so the caller can undo native side effects. A callback that
	 * sets the source itself wins; the result says whether the source now holds `next`.
	 */
	set<D extends Cancelable>(
		next: T,
		details: D,
		onChange?: (value: T, details: D) => void,
	): boolean {
		const before = untrack(() => this.#source.value);
		callUser(onChange, next, details);
		if (details.isCanceled) {
			return false;
		}
		const after = untrack(() => this.#source.value);
		if (!Object.is(before, after)) {
			if (after !== undefined) {
				this.#local = after;
			}
			return Object.is(
				untrack(() => this.#read()),
				next,
			);
		}
		return this.#write(next);
	}

	/**
	 * Restores the default without calling the change callback, as a native form reset fires no
	 * input or change events. Returns `false` when the source declined the write.
	 */
	reset(): boolean {
		return this.#write(untrack(this.#options.default));
	}

	/**
	 * Writes `next` without the change callback: a value the platform already shows (text typed
	 * before hydration, as a native `bind:value` adopts it). Returns `false` when declined.
	 */
	assign(next: T): boolean {
		return this.#write(next);
	}

	#write(next: T): boolean {
		const previous = untrack(() => this.#local);
		this.#local = next;
		this.#writeSource(
			next,
			untrack(() => this.#source.value),
		);
		if (
			Object.is(
				untrack(() => this.#read()),
				next,
			)
		) {
			return true;
		}
		// The binding declined: the local value must not hold the rejected one, or it would show
		// once the source becomes `undefined`.
		this.#local = previous;
		return false;
	}

	/** Development warnings. Call once during component init (it creates an effect). */
	connect(): void {
		if (!DEV || !this.#initiallyUncontrolled) {
			return;
		}
		const { name, state } = this.#options;
		// The default the user passes: a change after the first render has no effect.
		watch(
			this.#options.default,
			() => {
				error(
					`A component is changing the default ${state} state of an uncontrolled ${name} after being initialized.`,
					`To suppress this warning opt to use a controlled ${name}.`,
				);
			},
			{ lazy: true },
		);
	}
}

/** For an array read back as a proxy: each object item the proxy holds, mapped to the one written. */
function echoedItems(written: unknown, readBack: object): Map<unknown, unknown> | null {
	if (!Array.isArray(written) || !Array.isArray(readBack)) {
		return null;
	}
	const items = new Map<unknown, unknown>();
	untrack(() => {
		written.forEach((item, index) => {
			const echoed: unknown = readBack[index];
			if (isObject(item) && echoed !== item) {
				items.set(echoed, item);
			}
		});
	});
	return items;
}

function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
	return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
}

// Svelte's `$state` proxies plain objects and arrays only.
function isObject(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}
