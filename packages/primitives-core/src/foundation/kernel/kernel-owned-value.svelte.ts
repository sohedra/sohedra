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
