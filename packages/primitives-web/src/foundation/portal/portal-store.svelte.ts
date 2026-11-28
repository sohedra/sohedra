// A portal's state, which the focus manager inside it reads and writes: the portal node, and the
// guards around the portal and around the popup that carry Tab between the trigger and the
// portalled popup.

/** What a focus manager inside a portal tells the portal, which renders guards for it. */
export interface PortalFocusManagerView {
	readonly modal: boolean;
	readonly open: boolean;
	readonly anchorElement: Element | null;
	readonly onOpenChange: (open: boolean, event: Event) => void;
}

/**
 * A portal's platform state, shared with the focus manager inside it: the portal node, and the
 * guards around the portal (outside) and around the popup (inside) that bridge Tab between the
 * trigger and the portalled popup.
 */
export class PortalStore {
	#portalNode: HTMLElement | null = $state.raw(null);
	#focusManagerState: PortalFocusManagerView | null = $state.raw(null);
	#guardBeforeOutside: HTMLElement | null = null;
	#guardAfterOutside: HTMLElement | null = null;
	#guardBeforeInside: HTMLElement | null = null;
	#guardAfterInside: HTMLElement | null = null;

	/** The portal node, once rendered. */
	get portalNode(): HTMLElement | null {
		return this.#portalNode;
	}

	/** What the focus manager inside tells the portal. */
	get focusManagerState(): PortalFocusManagerView | null {
		return this.#focusManagerState;
	}

	/** The guard before the portal. */
	get guardBeforeOutside(): HTMLElement | null {
		return this.#guardBeforeOutside;
	}

	/** The guard after the portal. */
	get guardAfterOutside(): HTMLElement | null {
		return this.#guardAfterOutside;
	}

	/** The guard before the popup, inside the portal. */
	get guardBeforeInside(): HTMLElement | null {
		return this.#guardBeforeInside;
	}

	/** The guard after the popup, inside the portal. */
	get guardAfterInside(): HTMLElement | null {
		return this.#guardAfterInside;
	}

	/** Sets the portal node, `null` when it unmounts. */
	setPortalNode = (value: HTMLElement | null): void => {
		this.#portalNode = value;
	};

	/** Sets the state of the focus manager inside, `null` when it stops. */
	setFocusManagerState = (value: PortalFocusManagerView | null): void => {
		this.#focusManagerState = value;
	};

	/** Sets the guard before the portal. */
	setGuardBeforeOutside = (value: HTMLElement | null): void => {
		this.#guardBeforeOutside = value;
	};

	/** Sets the guard after the portal. */
	setGuardAfterOutside = (value: HTMLElement | null): void => {
		this.#guardAfterOutside = value;
	};

	/** Sets the guard before the popup, inside the portal. */
	setGuardBeforeInside = (value: HTMLElement | null): void => {
		this.#guardBeforeInside = value;
	};

	/** Sets the guard after the popup, inside the portal. */
	setGuardAfterInside = (value: HTMLElement | null): void => {
		this.#guardAfterInside = value;
	};
}
