import { untrack } from "svelte";

import { CommittedValue, type PlatformTypes } from "../kernel/index.js";
import type { PopupView } from "../popup/index.js";
import type { AnchoredViewportState } from "./position-types.js";
import {
	type ContentKey,
	getActivationDirection,
	nextContentKey,
	type TriggerOffset,
} from "./position-viewport-rules.js";

/** What a popup Viewport's content bookkeeping is given once. */
export interface ViewportContentStoreDeps<T extends PlatformTypes = PlatformTypes> {
	/** The popup the Viewport is in: its trigger and payload are compared by identity only. */
	readonly popup: Pick<
		PopupView<T>,
		"open" | "mounted" | "activeTriggerId" | "activeTriggerElement" | "payload" | "instantType"
	>;
	/** Measures how far the centre of `to` lies from the centre of `from`: the platform's layout read. */
	readonly measureTriggerOffset: (from: T["element"], to: T["element"]) => TriggerOffset;
}

/** The open popup moving its content from one trigger to another. */
export interface ViewportTriggerChange<T extends PlatformTypes = PlatformTypes> {
	readonly from: T["element"];
	readonly to: T["element"];
}

/**
 * Which content a popup Viewport shows, when the trigger changes, and the Viewport part's state:
 *
 * - {@link contentKey} changes whenever the content has to be created anew: on every new active
 *   trigger id, and once more when that trigger's payload arrives an update after the trigger.
 * - {@link triggerChange} is set while the open popup's trigger differs from the one whose content
 *   it last showed. The platform shows the change (snapshot, animation), then calls {@link settle}.
 * - {@link state} is transitioning while the trigger changes and while the previous content is on
 *   its way out ({@link showPrevious} to {@link clearPrevious}).
 */
export class ViewportContentStore<T extends PlatformTypes = PlatformTypes> {
	readonly #popup: ViewportContentStoreDeps<T>["popup"];
	readonly #measureTriggerOffset: ViewportContentStoreDeps<T>["measureTriggerOffset"];

	// What the last update settled on; written only by the commit in `connect()`.
	readonly #committed: CommittedValue<ContentKey>;
	// Derived, so the key changes in the same update as the trigger or payload, before anything
	// renders with it. A re-run with older values (an effect teardown) changes nothing.
	// `$derived.by` because `#props` is set in the constructor, after these initialisers.
	readonly #next: ContentKey = $derived.by(() =>
		nextContentKey(this.#committed.current, this.#popup.activeTriggerId, this.#popup.payload),
	);
	readonly contentKey: number = $derived(this.#next.key);

	// The trigger whose content the open popup showed when the platform last settled.
	#shown: T["element"] | null = $state.raw(null);

	readonly triggerChange: ViewportTriggerChange<T> | null = $derived.by(() => {
		const from = this.#shown;
		const to = this.#popup.activeTriggerElement;
		if (!from || !to || from === to || !this.#popup.open || !this.#popup.mounted) {
			return null;
		}
		return { from, to };
	});

	/**
	 * Where the content moves from, during the update that changes the trigger. Measured while
	 * deriving (a layout read in a derived, on purpose): the new content renders with its starting
	 * style and `data-activation-direction` in that same update, before the platform first styles
	 * it, whichever order its effects run in. An effect would be an update late.
	 */
	readonly incomingOffset: TriggerOffset | null = $derived.by(() => {
		const change = this.triggerChange;
		return change ? this.#measureTriggerOffset(change.from, change.to) : null;
	});

	// The offset of the last trigger change whose previous content is shown, and whether it still
	// is (on its way out).
	#previousOffset: TriggerOffset | null = $state.raw(null);
	#previousShown = $state(false);

	/** The Viewport part's state. */
	readonly state: AnchoredViewportState = $derived.by(() => ({
		activationDirection: getActivationDirection(this.incomingOffset ?? this.#previousOffset),
		transitioning: this.#previousShown || this.incomingOffset != null,
		instant: this.#popup.instantType,
	}));

	/** Pure: the popup is read inside the deriveds, so each value stays reactive. */
	constructor(deps: ViewportContentStoreDeps<T>) {
		const popup = deps.popup;
		this.#popup = popup;
		this.#measureTriggerOffset = deps.measureTriggerOffset;
		this.#committed = new CommittedValue<ContentKey>({
			initial: {
				triggerId: untrack(() => popup.activeTriggerId),
				payload: untrack(() => popup.payload),
				pendingPayload: false,
				key: 0,
			},
		});
	}

	/**
	 * The platform has shown the content for the current trigger (and the change to it, if any).
	 * A closed popup shows no trigger's content, so reopening is never a trigger change.
	 */
	settle = (): void => {
		untrack(() => {
			this.#shown = this.#popup.open ? this.#popup.activeTriggerElement : null;
		});
	};

	/** The platform shows the content shown before the trigger change moved by `offset`. */
	showPrevious = (offset: TriggerOffset): void => {
		this.#previousOffset = offset;
		this.#previousShown = true;
	};

	/** The previous content is gone. */
	clearPrevious = (): void => {
		this.#previousShown = false;
	};

	/**
	 * Commits each update's content key, so the next one is counted from it. The key is derived
	 * from committed state plus the current trigger and payload, so when this runs doesn't change
	 * the answer. Call once during component init (it creates an effect).
	 */
	connect(): void {
		// Keeps the committed key in step with the derived one, before the platform renders. Also on
		// mount: `open` (or the trigger) may have moved since the constructor.
		this.#committed.follow(() => this.#next);
	}
}
