import type { PlatformTypes } from "../kernel/index.js";
import type { PopupPortalState } from "./popup-types.js";
import type { PopupView } from "./popup-view.js";

/** What a popup's Portal reads of its part. */
export interface PopupPortalStoreProps {
	/** Whether the portal keeps the popup mounted while it is closed (`keepMounted`). */
	readonly keepMounted: boolean;
}

/** What a popup's Portal is given once. */
export interface PopupPortalStoreDeps<T extends PlatformTypes = PlatformTypes> {
	/** The popup the Portal holds. */
	readonly popup: Pick<PopupView<T>, "mounted">;
}

/**
 * A popup Portal part's state: whether it renders, and whether it keeps the popup mounted while
 * closed, which the parts inside it (the Positioner) read through the component's context.
 */
export class PopupPortalStore<T extends PlatformTypes = PlatformTypes> {
	// 1. Inputs
	readonly #props: () => PopupPortalStoreProps;
	readonly #popup: PopupPortalStoreDeps<T>["popup"];

	// 3. Public state. `$derived.by` because the inputs are assigned in the constructor, after these
	// initialisers.
	/** The Portal part's state: it has no fields. */
	readonly state: PopupPortalState = {};
	/** Whether the portal renders: the popup is mounted, or the portal keeps it mounted. */
	readonly mounted: boolean = $derived.by(() => this.#popup.mounted || this.#props().keepMounted);

	/** Pure: `props` is called inside the derived, so each prop stays reactive. */
	constructor(props: () => PopupPortalStoreProps, deps: PopupPortalStoreDeps<T>) {
		this.#props = props;
		this.#popup = deps.popup;
	}

	/** Whether the portal keeps the popup mounted while it is closed. */
	get keepMounted(): boolean {
		return this.#props().keepMounted;
	}
}
