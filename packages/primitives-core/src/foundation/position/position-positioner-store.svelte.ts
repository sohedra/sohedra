import { untrack } from "svelte";

import { type PlatformTypes, watch } from "../kernel/index.js";
import { movesToOtherTrigger, type PopupView } from "../popup/index.js";
import type {
	AnchoredArrowState,
	AnchoredPopupState,
	AnchoredPositionerState,
	Align,
	MeasuredPosition,
	Side,
} from "./position-types.js";

/** What a Positioner's state reads of its part. */
export interface PositionerStoreProps {
	/** Whether the popup stays mounted while closed (its Portal's `keepMounted`). */
	readonly keepMounted: boolean;
}

/** What a Positioner's state is given once. */
export interface PositionerStoreDeps<T extends PlatformTypes = PlatformTypes> {
	/** The position before the first computation. */
	readonly initial: MeasuredPosition;
	/** The popup the Positioner places. */
	readonly popup: PopupView<T>;
}

/**
 * A Positioner's measured state, shared with the Popup, Arrow and Viewport parts, and the state of
 * the Positioner, Popup and Arrow parts. The platform writes {@link position} after each
 * computation (one object each); parts derive their styles from it.
 */
export class PositionerStore<T extends PlatformTypes = PlatformTypes> {
	readonly #props: () => PositionerStoreProps;
	readonly #popup: PopupView<T>;
	#position: MeasuredPosition = $state.raw() as MeasuredPosition;
	#arrowElement: T["element"] | null = $state.raw(null);

	// Compared by value: a part's state is derived again when one of these changes, not on every
	// new position.
	/** The side the popup is placed on, logical (`inline-start`) where asked so. */
	readonly side: Side = $derived(this.#position.side);
	/** How the popup is aligned to its side. */
	readonly align: Align = $derived(this.#position.align);
	/** Whether the anchor is hidden from view. */
	readonly anchorHidden: boolean = $derived(this.#position.anchorHidden);
	/** Whether the arrow can't point at the anchor's centre (also before it is measured). */
	readonly arrowUncentered: boolean = $derived(this.#position.arrow?.centerOffset !== 0);

	// `$derived.by` because `#popup` is assigned in the constructor, after these initialisers.
	/** The Positioner part's state. */
	readonly state: AnchoredPositionerState = $derived.by(() => ({
		open: this.#popup.open,
		side: this.side,
		align: this.align,
		anchorHidden: this.anchorHidden,
		instant: this.#popup.instantType,
	}));
	/** The Popup part's state: the popup's open state and transition, this placement. */
	readonly popupState: AnchoredPopupState = $derived.by(() => ({
		open: this.#popup.open,
		side: this.side,
		align: this.align,
		instant: this.#popup.instantType,
		transitionStatus: this.#popup.transitionStatus,
	}));
	/** The Arrow part's state: the popup's open state, this placement of the arrow. */
	readonly arrowState: AnchoredArrowState = $derived.by(() => ({
		open: this.#popup.open,
		side: this.side,
		align: this.align,
		uncentered: this.arrowUncentered,
	}));

	constructor(props: () => PositionerStoreProps, deps: PositionerStoreDeps<T>) {
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

	/** Sets the Arrow part's element, `null` when it unmounts. */
	setArrowElement = (element: T["element"] | null): void => {
		this.#arrowElement = element;
	};

	/** Lifetime work. Called once by the Positioner part. */
	connect(): void {
		const popup = this.#popup;
		const activeTrigger = popup.activeTrigger;
		// Closing drops a pending or applied trigger change.
		watch(
			() => popup.open,
			(open) => {
				if (!open) {
					activeTrigger.closeTriggerChange();
				}
			},
		);
		// A new trigger while open runs the transitions once more. The last trigger is this
		// Positioner's own memory, not the watched previous value: an anchor cleared while closed
		// keeps it. Any anchor change ends a move that is still pending.
		let lastTrigger: T["element"] | null = null;
		watch(
			() => popup.anchorElement,
			(current) => {
				const previous = lastTrigger;
				if (current) {
					lastTrigger = current;
				}
				if (!movesToOtherTrigger(previous, current, popup.open)) {
					return;
				}
				activeTrigger.beginTriggerChange();
				return activeTrigger.cancelTriggerChange;
			},
		);
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
