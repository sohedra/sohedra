import { untrack } from "svelte";

import { type PlatformTypes, watch } from "../kernel/index.js";
import { type ContentKeyState, nextContentKey } from "./position-viewport-rules.js";

/** What a popup Viewport's content bookkeeping reads from its popup. */
export interface ViewportContentStoreProps<T extends PlatformTypes = PlatformTypes> {
	readonly open: boolean;
	readonly mounted: boolean;
	/** The id of the trigger the popup belongs to. */
	readonly activeTriggerId: string | null;
	/** The trigger the popup belongs to; compared by identity only. */
	readonly activeTrigger: T["element"] | null;
	/** The active trigger's payload; compared by identity only. */
	readonly payload: unknown;
}

/** The open popup moving its content from one trigger to another. */
export interface ViewportSwitch<T extends PlatformTypes = PlatformTypes> {
	readonly from: T["element"];
	readonly to: T["element"];
}

/**
 * Which content a popup Viewport shows, and when it switches:
 *
 * - {@link contentKey} changes whenever the content has to be created anew: on every new active
 *   trigger id, and once more when that trigger's payload arrives an update after the trigger.
 * - {@link switching} is set while the open popup's trigger differs from the one whose content it
 *   last showed. The platform shows the switch (snapshot, animation), then calls {@link settle}.
 */
export class ViewportContentStore<T extends PlatformTypes = PlatformTypes> {
	readonly #props: () => ViewportContentStoreProps<T>;

	// What the last update settled on; written only by the commit in `connect()`.
	#committed: ContentKeyState = $state.raw({
		triggerId: null,
		payload: undefined,
		pendingPayload: false,
		key: 0,
	});
	// Derived, so the key changes in the same update as the trigger or payload, before anything
	// renders with it. A re-run with older values (an effect teardown) changes nothing.
	// `$derived.by` because `#props` is set in the constructor, after these initialisers.
	readonly #next: ContentKeyState = $derived.by(() =>
		nextContentKey(this.#committed, this.#props().activeTriggerId, this.#props().payload),
	);
	readonly contentKey: number = $derived(this.#next.key);

	// The trigger whose content the open popup showed when the platform last settled.
	#shown: T["element"] | null = $state.raw(null);

	readonly switching: ViewportSwitch<T> | null = $derived.by(() => {
		const from = this.#shown;
		const to = this.#props().activeTrigger;
		if (!from || !to || from === to || !this.#props().open || !this.#props().mounted) {
			return null;
		}
		return { from, to };
	});

	/** Pure: `props` is called inside the deriveds, so each value stays reactive. */
	constructor(props: () => ViewportContentStoreProps<T>) {
		this.#props = props;
		this.#committed = {
			triggerId: untrack(() => props().activeTriggerId),
			payload: untrack(() => props().payload),
			pendingPayload: false,
			key: 0,
		};
	}

	/**
	 * The platform has shown the content for the current trigger (and the switch to it, if any).
	 * A closed popup shows no trigger's content, so reopening never switches.
	 */
	settle(): void {
		untrack(() => {
			this.#shown = this.#props().open ? this.#props().activeTrigger : null;
		});
	}

	/**
	 * Commits each update's content key, so the next one is counted from it. The key is derived
	 * from committed state plus the current trigger and payload, so when this runs doesn't change
	 * the answer. Call once during component init (it creates an effect).
	 */
	connect(): void {
		// Keeps the committed key in step with the derived one, before the platform renders. Also on
		// mount: `open` (or the trigger) may have moved since the constructor.
		watch.pre(
			() => this.#next,
			(next) => {
				this.#committed = next;
			},
			{ lazy: false },
		);
	}
}
