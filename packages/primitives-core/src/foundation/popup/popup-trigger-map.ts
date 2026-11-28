// A popup's registered triggers by id, reactive so the popup follows which ones are mounted.

import { SvelteMap } from "svelte/reactivity";

import type { PlatformTypes } from "../kernel/index.js";

/**
 * A popup's registered trigger elements by trigger id. Reactive (a `SvelteMap`): the popup derives
 * its implicit active trigger and the triggers' `aria-controls` from it. Elements are opaque here;
 * containment checks come from the caller.
 */
export class PopupTriggerMap<T extends PlatformTypes = PlatformTypes> {
	#ids = new SvelteMap<string, T["element"]>();
	// The reverse index, to refuse one element registered under two ids.
	readonly #idOf = new WeakMap<T["element"], string>();

	/**
	 * Adds a trigger element under `id`. An element may be registered under one id only: a second
	 * id throws, in production too.
	 */
	add(id: string, element: T["element"]): void {
		const existingId = this.#idOf.get(element);
		if (existingId !== undefined && existingId !== id) {
			throw new Error("Sohedra: A trigger element cannot be registered under multiple IDs.");
		}
		// Reusing an id for a different element evicts the previous element's claim.
		const previous = this.#ids.get(id);
		if (previous !== undefined && previous !== element) {
			this.#idOf.delete(previous);
		}
		this.#idOf.set(element, id);
		this.#ids.set(id, element);
	}

	/** Removes the trigger registered under `id`. */
	delete(id: string): void {
		const element = this.#ids.get(id);
		if (element !== undefined) {
			this.#idOf.delete(element);
		}
		this.#ids.delete(id);
	}

	/** Whether `element` is a registered trigger. */
	hasElement(element: T["element"]): boolean {
		for (const registered of this.#ids.values()) {
			if (registered === element) {
				return true;
			}
		}
		return false;
	}

	/** Whether a registered trigger matches `predicate`. */
	hasMatchingElement(predicate: (element: T["element"]) => boolean): boolean {
		for (const element of this.#ids.values()) {
			if (predicate(element)) {
				return true;
			}
		}
		return false;
	}

	/** The element of the trigger registered under `id`. */
	getById(id: string): T["element"] | undefined {
		return this.#ids.get(id);
	}

	/** The `[id, element]` entries, in registration order. */
	entries(): IterableIterator<[string, T["element"]]> {
		return this.#ids.entries();
	}

	/** The registered trigger elements. */
	elements(): IterableIterator<T["element"]> {
		return this.#ids.values();
	}

	/** How many triggers are registered. */
	get size(): number {
		return this.#ids.size;
	}
}
