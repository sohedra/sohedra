// The focus guards that carry Tab between a non-modal popup's active trigger and its portalled
// content: which elements they are, recorded by the platform and read on focus moves.

import type { PlatformTypes } from "../kernel/index.js";

/**
 * The focus guards that bridge Tab between a non-modal popup's active trigger and its portalled
 * content: bookkeeping nothing renders, read on focus moves.
 */
export class TriggerFocusGuards<T extends PlatformTypes = PlatformTypes> {
	#beforeTrigger: T["element"] | null = null;
	#afterTrigger: T["element"] | null = null;
	#beforeContent: T["element"] | null = null;

	/** The guard before the active trigger, treated as inside the popup by the focus manager. */
	get beforeTrigger(): T["element"] | null {
		return this.#beforeTrigger;
	}

	/** The guard after the active trigger: Tab from the popup's end lands here. */
	get afterTrigger(): T["element"] | null {
		return this.#afterTrigger;
	}

	/** The guard before the popup's content. */
	get beforeContent(): T["element"] | null {
		return this.#beforeContent;
	}

	/** Records the guard before the active trigger (or `null` when it goes away). */
	setBeforeTrigger(element: T["element"] | null): void {
		this.#beforeTrigger = element;
	}

	/** Records the guard after the active trigger (or `null` when it goes away). */
	setAfterTrigger(element: T["element"] | null): void {
		this.#afterTrigger = element;
	}

	/** Records the guard before the popup's content (or `null` when it goes away). */
	setBeforeContent(element: T["element"] | null): void {
		this.#beforeContent = element;
	}
}
