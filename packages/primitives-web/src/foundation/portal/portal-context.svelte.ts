// A portal's state, which the focus manager inside it reads and writes: the portal node, and the
// guards around the portal and around the popup that carry Tab between the trigger and the
// portalled popup. It is one context for the whole page, so a popup nested in another finds its
// parent's portal.

import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";

/** What a focus manager inside a portal tells the portal, which renders guards for it. */
export interface PortalFocusManagerState {
	readonly modal: boolean;
	readonly open: boolean;
	readonly domReference: Element | null;
	readonly onOpenChange: (open: boolean, event: Event) => void;
}

/**
 * A portal's platform state, shared with the focus manager inside it: the portal node, and the
 * guards around the portal (outside) and around the popup (inside) that bridge Tab between the
 * trigger and the portalled popup.
 */
export class FloatingPortalState {
	#portalNode: HTMLElement | null = $state.raw(null);
	#focusManagerState: PortalFocusManagerState | null = $state.raw(null);
	#beforeOutsideGuard: HTMLElement | null = null;
	#afterOutsideGuard: HTMLElement | null = null;
	#beforeInsideGuard: HTMLElement | null = null;
	#afterInsideGuard: HTMLElement | null = null;

	/** The portal node, once rendered. */
	get portalNode(): HTMLElement | null {
		return this.#portalNode;
	}

	/** What the focus manager inside tells the portal. */
	get focusManagerState(): PortalFocusManagerState | null {
		return this.#focusManagerState;
	}

	/** The guard before the portal. */
	get beforeOutsideGuard(): HTMLElement | null {
		return this.#beforeOutsideGuard;
	}

	/** The guard after the portal. */
	get afterOutsideGuard(): HTMLElement | null {
		return this.#afterOutsideGuard;
	}

	/** The guard before the popup, inside the portal. */
	get beforeInsideGuard(): HTMLElement | null {
		return this.#beforeInsideGuard;
	}

	/** The guard after the popup, inside the portal. */
	get afterInsideGuard(): HTMLElement | null {
		return this.#afterInsideGuard;
	}

	setPortalNode = (value: HTMLElement | null): void => {
		this.#portalNode = value;
	};

	setFocusManagerState = (value: PortalFocusManagerState | null): void => {
		this.#focusManagerState = value;
	};

	setBeforeOutsideGuard = (value: HTMLElement | null): void => {
		this.#beforeOutsideGuard = value;
	};

	setAfterOutsideGuard = (value: HTMLElement | null): void => {
		this.#afterOutsideGuard = value;
	};

	setBeforeInsideGuard = (value: HTMLElement | null): void => {
		this.#beforeInsideGuard = value;
	};

	setAfterInsideGuard = (value: HTMLElement | null): void => {
		this.#afterInsideGuard = value;
	};
}

export const FloatingPortalContext = defineContext<FloatingPortalState>(
	"FloatingPortalContext",
	"Focus managers read it through `getOr(null)`.",
);
