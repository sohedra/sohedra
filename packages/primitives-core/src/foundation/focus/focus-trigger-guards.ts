// The focus guards that carry Tab between a non-modal popup's active trigger and its portalled
// content: which elements they are, recorded by the platform and read on focus moves.

import type { PlatformTypes } from "../kernel/index.js";

/**
 * The focus guards that bridge Tab between a non-modal popup's active trigger and its portalled
 * content: bookkeeping nothing renders, read on focus moves.
 */
export class TriggerFocusGuards<T extends PlatformTypes = PlatformTypes> {
	#guardBeforeTrigger: T["element"] | null = null;
	#guardAfterTrigger: T["element"] | null = null;
	#guardBeforeContent: T["element"] | null = null;

	/** The guard before the active trigger, treated as inside the popup by the focus manager. */
	get guardBeforeTrigger(): T["element"] | null {
		return this.#guardBeforeTrigger;
	}

	/** The guard after the active trigger: Tab from the popup's end lands here. */
	get guardAfterTrigger(): T["element"] | null {
		return this.#guardAfterTrigger;
	}

	/** The guard before the popup's content. */
	get guardBeforeContent(): T["element"] | null {
		return this.#guardBeforeContent;
	}

	/** Records the guard before the active trigger (or `null` when it goes away). */
	setGuardBeforeTrigger(element: T["element"] | null): void {
		this.#guardBeforeTrigger = element;
	}

	/** Records the guard after the active trigger (or `null` when it goes away). */
	setGuardAfterTrigger(element: T["element"] | null): void {
		this.#guardAfterTrigger = element;
	}

	/** Records the guard before the popup's content (or `null` when it goes away). */
	setGuardBeforeContent(element: T["element"] | null): void {
		this.#guardBeforeContent = element;
	}
}
