// The popup side of a popup's hover: keeps a hover-opened popup open while the pointer is over it,
// and closes it when the pointer leaves.

import { type PlatformTypes, Timeout } from "../kernel/index.js";
import type { PopupView } from "../popup/index.js";
import { getDelay, hasOpenChild, isHoverOpenEvent, isPinned } from "./hover-rules.js";
import { changeOpen } from "./hover-trigger-store.js";
import type { HoverEvent } from "./hover-types.js";

/** The popup element's hover props. Read when a pointer event arrives. */
export interface HoverPopupStoreProps {
	/** Whether hovering the popup keeps it open. */
	readonly enabled: boolean;
	/** How long to wait before closing once the pointer leaves, in ms. */
	readonly closeDelay: number;
}

/** What the popup's hover store is given once. */
export interface HoverPopupStoreDeps<T extends PlatformTypes = PlatformTypes> {
	/** The popup it keeps open and closes. */
	readonly popup: PopupView<T>;
	/**
	 * Lets the platform apply a committed hover change at once (web: `flushSync`), so running
	 * animations see the new state.
	 */
	readonly flush: () => void;
}

/**
 * The popup side of a popup's hover: keeps a hover-opened popup open while hovered and closes it
 * when the pointer leaves, unless it moved into a trigger, a nested popup or the safe polygon,
 * or the popup was opened by a click.
 */
export class HoverPopupStore<T extends PlatformTypes = PlatformTypes> {
	readonly #popup: PopupView<T>;
	readonly #props: () => HoverPopupStoreProps;
	readonly #flush: () => void;
	readonly #childClosedTimeout: Timeout;

	/** `props` is read when a pointer event arrives. */
	constructor(props: () => HoverPopupStoreProps, deps: HoverPopupStoreDeps<T>) {
		this.#popup = deps.popup;
		this.#props = props;
		this.#flush = deps.flush;
		this.#childClosedTimeout = new Timeout(deps.popup.platform.scheduler);
	}

	// Closes once the last open child closed, unless the pointer came back meanwhile.
	readonly #onNodeClosed = (event: HoverEvent<T>) => {
		const popup = this.#popup;
		const tree = popup.tree;
		if (!tree || hasOpenChild(popup)) {
			return;
		}
		// Let the pointer's entering fire first, in case the child closed because it moved here.
		this.#childClosedTimeout.start(0, () => {
			tree.events.off("popup.closed", this.#onNodeClosed);
			changeOpen(popup, this.#flush, false, event);
			tree.events.emit("popup.closed", event);
		});
	};

	/** A press inside the popup: on an interactive element, `opensPopup` if it opens another one. */
	pressInside = (interactive: boolean, opensPopup: boolean): void => {
		this.#popup.hover.setInteractedInside(interactive && opensPopup);
	};

	/** The pointer entered the popup. */
	enter = (): void => {
		this.#popup.hover.openChangeTimeout.clear();
		this.#childClosedTimeout.clear();
		this.#popup.tree?.events.off("popup.closed", this.#onNodeClosed);
	};

	/**
	 * The pointer left the popup, into another enabled trigger, into a nested popup, or elsewhere.
	 */
	leave = (event: HoverEvent<T>, into: { enabledTrigger: boolean; descendant: boolean }): void => {
		const popup = this.#popup;
		const shared = popup.hover;
		const tree = popup.tree;
		if (hasOpenChild(popup) && tree) {
			tree.events.on("popup.closed", this.#onNodeClosed);
			return;
		}
		if (into.enabledTrigger || into.descendant) {
			return;
		}
		// An active safe polygon decides.
		const handler = shared.handler;
		if (handler) {
			handler(event);
			return;
		}
		// Only an open popup closes when the pointer leaves it: the recorded open event outlives a
		// close the app makes itself, and that popup has nothing left to close.
		if (popup.open && isHoverOpenEvent(popup.openEventType) && !isPinned(popup)) {
			const closeDelay = getDelay(this.#props().closeDelay, "close", shared.pointerType);
			const close = () => {
				changeOpen(popup, this.#flush, false, event);
				tree?.events.emit("popup.closed", event);
			};
			if (closeDelay) {
				shared.openChangeTimeout.start(closeDelay, close);
			} else {
				shared.openChangeTimeout.clear();
				close();
			}
		}
	};

	/** The popup's listeners went away: drops the pending child-closed check. */
	stop = (): void => {
		this.#popup.tree?.events.off("popup.closed", this.#onNodeClosed);
		this.#childClosedTimeout.clear();
	};
}
