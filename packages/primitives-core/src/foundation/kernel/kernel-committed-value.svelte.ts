import { watch } from "./kernel-watch.svelte.js";

/**
 * The memory of what the last update settled on: a step derived from the committed value and the
 * current state is committed after each update, before the platform draws it, so the next step
 * is counted from it. An intent that resets the step writes the memory directly.
 *
 * A store holds it as an owned object and calls `follow` once in its `connect()`.
 */
export class CommittedValue<T> {
	#current: T = $state.raw() as T;

	constructor(initial: T) {
		this.#current = initial;
	}

	/** What the last update settled on. Reactive: a step derived from it re-runs when it moves. */
	get current(): T {
		return this.#current;
	}

	/** Writes the memory now: an intent that resets the step, or a step that finishes. */
	commit = (value: T): void => {
		this.#current = value;
	};

	/**
	 * Commits `next()` after each update that changes it, and once on mount, since state may have
	 * moved since the store was built. Committing the step a derived made from this memory is a
	 * fixed point, so when this runs doesn't change the answer. Call once in `connect()`.
	 */
	follow(next: () => T): void {
		// Keeps the memory in step with the derived step, before the platform draws the update.
		watch.pre(next, (value) => this.commit(value));
	}
}
