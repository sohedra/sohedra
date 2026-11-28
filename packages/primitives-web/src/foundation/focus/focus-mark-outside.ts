// Hides what is outside an open popup: from assistive technology (`aria-hidden`, for a popup that
// traps focus) and from outside-press dismissal (the inert marker, always).

import { activeElement, contains, ownerDocument } from "../kernel/index.js";
import { markOthers } from "./focus-mark-others.js";
import { PORTAL_ATTRIBUTE } from "./focus-markers.js";

/** What {@link markOutside} did, and how to adjust and undo it. */
export interface OutsideMarking {
	/** The other popup's portal left exposed because it held focus. */
	readonly exempt: Element | null;
	/** Focus moved into another popup's portal: hides again around that portal instead. */
	hideAround(focusedPortal: Element): void;
	undo(): void;
}

export interface MarkOutsideOptions {
	/** The portal the popup renders in. Portals nested in it stay exposed. */
	readonly portalNode: HTMLElement | null | undefined;
	/** Elements outside the popup that stay exposed: guards, the popup's other elements. */
	readonly exposed: readonly Element[];
	/** Whether outside content is also hidden from assistive technology. */
	readonly ariaHidden: boolean;
}

/** The portal of another popup that holds focus, if any. */
export function focusedOtherPortal(floating: Element): Element | null {
	const portal = activeElement(ownerDocument(floating))?.closest(`[${PORTAL_ATTRIBUTE}]`);
	return portal && !contains(portal, floating) ? portal : null;
}

/**
 * Marks everything outside `floating`. Another popup's portal that holds focus is never hidden
 * from assistive technology: `aria-hidden` on focused content is an accessibility error, and it
 * would happen when an unrelated popup opens in the same update, comes later in the markup and so
 * takes focus. The inert marker still covers that portal: outside-press dismissal reads the
 * marker, not `aria-hidden`.
 */
export function markOutside(floating: Element, options: MarkOutsideOptions): OutsideMarking {
	const { portalNode, exposed, ariaHidden } = options;
	// Don't hide portals nested in the parent portal.
	const portalNodes = Array.from(portalNode?.querySelectorAll(`[${PORTAL_ATTRIBUTE}]`) || []);
	const insideElements = [floating, ...portalNodes, ...exposed];
	const hide = (focusedPortal: Element | null) =>
		markOthers(focusedPortal ? [...insideElements, focusedPortal] : insideElements, {
			ariaHidden,
			mark: false,
		});
	let exempt = focusedOtherPortal(floating);
	let ariaHiddenCleanup = hide(exempt);
	const markerCleanup = markOthers([floating, ...portalNodes]);
	return {
		get exempt() {
			return exempt;
		},
		hideAround(focusedPortal) {
			ariaHiddenCleanup();
			exempt = focusedPortal;
			ariaHiddenCleanup = hide(focusedPortal);
		},
		undo() {
			markerCleanup();
			ariaHiddenCleanup();
		},
	};
}
