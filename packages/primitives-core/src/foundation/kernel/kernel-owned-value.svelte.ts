import { untrack } from "svelte";

/**
 * A single-slot value that parts claim with an owner token: the newest claim wins, and a
 * release only clears the slot while its token still owns it, so a late teardown (an outgoing
 * part playing an `out:` transition) can't clear its replacement's value.
 */
export class OwnedValue<T> {
	#owner: object | null = null;
	#current: T | undefined = $state.raw();

	/** The owner's value, or `undefined` when unclaimed. */
	get current(): T | undefined {
		return this.#current;
	}

	/** Claims the slot for `token` with `value`. Returns the release function. */
	claim(token: object, value: T): () => void {
		this.#owner = token;
		this.#current = value;
		return () => {
			if (this.#owner === token) {
				this.#owner = null;
				this.#current = undefined;
			}
		};
	}
}

/**
 * Holds `claim(token, value)` while `get()` returns a value, releasing and re-claiming when it
 * changes (id registration: labels, legends, descriptions, errors). Runs
 * in effect timing, so ids registered by a later sibling appear after hydration. Call once while
 * a part initialises: it starts its own effect.
 */
export function useClaim<T>(
	claim: (token: object, value: T) => () => void,
	get: () => T | undefined,
): void {
	const token = {};
	const value = $derived.by(get);
	// The claim is held while `get()` gives a value, and taken again when it changes.
	$effect(() => {
		const current = value;
		if (current === undefined) {
			return;
		}
		return untrack(() => claim(token, current));
	});
}
