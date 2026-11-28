import { untrack } from "svelte";

import type { PlatformTypes } from "../kernel/index.js";
import type { Align, PositionState, Side } from "./position-types.js";

/** What a Positioner's state is given once. */
export interface PositionerStoreDeps {
	/** The position before the first computation. */
	readonly initial: PositionState;
}

/**
 * A Positioner's measured state, shared with the Popup, Arrow and Viewport parts. The platform
 * writes {@link position} after each computation (one object per computation); parts derive
 * styles and data attributes from it.
 */
export class PositionerStore<T extends PlatformTypes = PlatformTypes> {
	#position: PositionState = $state.raw() as PositionState;
	#arrowElement: T["element"] | null = $state.raw(null);

	// Compared by value: a part's state is derived again when one of these changes, not on every
	// new position.
	readonly side: Side = $derived(this.#position.side);
	readonly align: Align = $derived(this.#position.align);
	readonly anchorHidden: boolean = $derived(this.#position.anchorHidden);
	/** Whether the arrow can't point at the anchor's centre (also before it is measured). */
	readonly arrowUncentered: boolean = $derived(this.#position.arrow?.centerOffset !== 0);

	constructor(deps: PositionerStoreDeps) {
		this.#position = deps.initial;
	}

	/** The last computed position (one object per computation). */
	get position(): PositionState {
		return this.#position;
	}

	/** The Arrow part's element, which the platform measures to place the arrow. */
	get arrowElement(): T["element"] | null {
		return this.#arrowElement;
	}

	/** Writes a computed position. */
	setPosition(next: PositionState): void {
		this.#position = next;
	}

	/** The next opening starts unpositioned (a kept-mounted popup that closed). */
	markUnpositioned(): void {
		const position = untrack(() => this.#position);
		if (position.isPositioned) {
			this.#position = { ...position, isPositioned: false };
		}
	}

	setArrowElement(element: T["element"] | null): void {
		this.#arrowElement = element;
	}
}
