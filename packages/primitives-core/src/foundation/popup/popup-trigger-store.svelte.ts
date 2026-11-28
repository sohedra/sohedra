import { type PlatformTypes, REASONS } from "../kernel/index.js";
import type { PopupTriggerState } from "./popup-types.js";
import type { PopupView } from "./popup-view.js";

/** What a popup trigger's state reads of its part. */
export interface PopupTriggerStoreProps<T extends PlatformTypes = PlatformTypes> {
	/** The popup the trigger reads now: a handle's store changes when a Root attaches. */
	readonly popup: Pick<PopupView<T>, "activeTrigger" | "openChangeReason">;
	/** The trigger's id. */
	readonly id: string;
	/** The trigger's `disabled` prop. */
	readonly disabled: boolean;
}

/**
 * One popup trigger part's state: whether it is disabled, whether the popup is open from it, and
 * whether a press of it opened the popup (`data-pressed`, beside `data-popup-open`).
 */
export class PopupTriggerStore<T extends PlatformTypes = PlatformTypes> {
	// 1. Inputs
	readonly #props: () => PopupTriggerStoreProps<T>;

	// 3. Public state. `$derived.by` because `#props` is assigned in the constructor, after these
	// initialisers.
	/** Whether the popup is open from this trigger. */
	readonly #openedByThis: boolean = $derived.by(() => {
		const { popup, id } = this.#props();
		return popup.activeTrigger.isOpenedBy(id);
	});

	/** The trigger part's state. */
	readonly state: PopupTriggerState = $derived.by(() => ({
		disabled: this.#props().disabled,
		open: this.#openedByThis,
	}));

	/** Whether a press of this trigger opened the popup, while it is open from it. */
	readonly pressed: boolean = $derived.by(
		() => this.#openedByThis && this.#props().popup.openChangeReason === REASONS.triggerPress,
	);

	/** Pure: `props` is called inside the deriveds, so each prop stays reactive. */
	constructor(props: () => PopupTriggerStoreProps<T>) {
		this.#props = props;
	}
}
