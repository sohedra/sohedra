import { untrack } from "svelte";

import { type PlatformTypes, watch } from "../kernel/index.js";
import type { Align, MeasuredPosition, Side } from "./position-types.js";

/** What a Positioner's state reads of its part. */
export interface PositionerStoreProps {
	/** Whether the popup stays mounted while closed (its Portal's `keepMounted`). */
	readonly keepMounted: boolean;
}

/** What a Positioner's state reads of its popup, and asks of it. A popup store is one. */
export interface PositionerPopupView {
	/** Whether the popup is in the document: open, or closing. */
	readonly mounted: boolean;
	readonly activeTrigger: {
		/** Forgets the last trigger element (a kept-mounted popup that closed). */
		forgetLastTrigger(): void;
	};
}

/** What a Positioner's state is given once. */
export interface PositionerStoreDeps {
	/** The position before the first computation. */
	readonly initial: MeasuredPosition;
	/** The popup the Positioner places. */
	readonly popup: PositionerPopupView;
}

/**
 * A Positioner's measured state, shared with the Popup, Arrow and Viewport parts. The platform
 * writes {@link position} after each computation (one object per computation); parts derive
 * styles and data attributes from it.
 */
export class PositionerStore<T extends PlatformTypes = PlatformTypes> {
	readonly #props: () => PositionerStoreProps;
	readonly #popup: PositionerPopupView;
	#position: MeasuredPosition = $state.raw() as MeasuredPosition;
	#arrowElement: T["element"] | null = $state.raw(null);

	// Compared by value: a part's state is derived again when one of these changes, not on every
	// new position.
	readonly side: Side = $derived(this.#position.side);
	readonly align: Align = $derived(this.#position.align);
	readonly anchorHidden: boolean = $derived(this.#position.anchorHidden);
	/** Whether the arrow can't point at the anchor's centre (also before it is measured). */
	readonly arrowUncentered: boolean = $derived(this.#position.arrow?.centerOffset !== 0);

	constructor(props: () => PositionerStoreProps, deps: PositionerStoreDeps) {
		this.#props = props;
		this.#popup = deps.popup;
		this.#position = deps.initial;
	}

	/** The last computed position (one object per computation). */
	get position(): MeasuredPosition {
		return this.#position;
	}

	/** The Arrow part's element, which the platform measures to place the arrow. */
	get arrowElement(): T["element"] | null {
		return this.#arrowElement;
	}

	/** Writes a computed position. */
	setPosition = (next: MeasuredPosition): void => {
		this.#position = next;
	};

	/** The next opening starts unpositioned (a kept-mounted popup that closed). */
	markUnpositioned = (): void => {
		const position = untrack(() => this.#position);
		if (position.isPositioned) {
			this.#position = { ...position, isPositioned: false };
		}
	};

	setArrowElement = (element: T["element"] | null): void => {
		this.#arrowElement = element;
	};

	/** Lifetime work. Called once by the Positioner part. */
	connect(): void {
		// A kept-mounted popup's next opening starts unpositioned (a closing one unmounts instead).
		watch(
			[() => this.#props().keepMounted, () => this.#popup.mounted],
			([keepsMounted, mounted]) => {
				if (keepsMounted && !mounted) {
					// While a kept-mounted popup is closed, it has no element it is anchored to.
					this.#popup.activeTrigger.forgetLastTrigger();
					this.markUnpositioned();
				}
			},
		);
	}
}
