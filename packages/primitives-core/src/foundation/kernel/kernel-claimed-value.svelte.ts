/**
 * A single-slot value that parts claim with a token: the newest claim wins, and a release only
 * clears the slot while its token still holds the claim, so a late teardown (an outgoing part
 * playing an `out:` transition) can't clear its replacement's value.
 */
export class ClaimedValue<T> {
	#holder: object | null = null;
	#current: T | undefined = $state.raw();

	/** The newest claim's value, or `undefined` when unclaimed. */
	get current(): T | undefined {
		return this.#current;
	}

	/** Claims the slot for `token` with `value`. Returns the release function. */
	claim(token: object, value: T): () => void {
		this.#holder = token;
		this.#current = value;
		return () => {
			if (this.#holder === token) {
				this.#holder = null;
				this.#current = undefined;
			}
		};
	}
}
