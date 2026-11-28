// A portal's state, which the focus manager inside it reads and writes: the portal node, and the
// guards around the portal and around the popup that carry Tab between the trigger and the
// portalled popup. It is one context for the whole page, so a popup nested in another finds its
// parent's portal.

import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";

/** What a focus manager inside a portal tells the portal, which renders guards for it. */
export interface PortalFocusManagerState {
	readonly modal: boolean;
	readonly open: boolean;
	readonly closeOnFocusOut: boolean;
	readonly domReference: Element | null;
	readonly onOpenChange: (open: boolean, event: Event) => void;
}

/**
 * A portal's platform state, shared with the focus manager inside it: the portal node, and the
 * guards around the portal (outside) and around the popup (inside) that bridge Tab between the
 * trigger and the portalled popup.
 */
export class FloatingPortalState {
	portalNode: HTMLElement | null = $state.raw(null);
	focusManagerState: PortalFocusManagerState | null = $state.raw(null);
	beforeOutsideGuard: HTMLElement | null = null;
	afterOutsideGuard: HTMLElement | null = null;
	beforeInsideGuard: HTMLElement | null = null;
	afterInsideGuard: HTMLElement | null = null;
}

export const FloatingPortalContext = defineContext<FloatingPortalState>(
	"FloatingPortalContext",
	"Focus managers read it through `getOr(null)`.",
);
