import { ownerDocument } from "../kernel/index.js";
import { acquireScrollLock } from "./position-scroll-lock.js";
import type { AnchoredScrollLockOptions } from "./position-types.js";

const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

/**
 * Locks the page scroll for an anchored modal popup. A touch-opened popup locks only when it
 * nearly spans the viewport width, as phones do natively. `options` is called inside the derived
 * and the effect, so each option stays reactive. Call once during the Positioner's init.
 */
export function useAnchoredScrollLock(options: () => AnchoredScrollLockOptions): void {
	const touchOpenShouldLock = $derived.by(() => {
		const { enabled, touchOpen, positionerElement } = options();
		if (!enabled || !touchOpen || positionerElement == null) {
			return false;
		}
		const viewportWidth = ownerDocument(positionerElement).documentElement.clientWidth;
		const popupWidth = positionerElement.offsetWidth;
		return (
			viewportWidth > 0 &&
			popupWidth > 0 &&
			popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX
		);
	});
	// Compared by value: the lock is taken again only when one of these changes.
	const locks = $derived.by(() => {
		const { enabled, touchOpen } = options();
		return enabled && !(touchOpen && !touchOpenShouldLock);
	});
	const referenceElement = $derived(options().referenceElement);

	// Holds the page's scroll lock while the popup asks for it.
	$effect(() => {
		if (!locks) {
			return;
		}
		return acquireScrollLock(referenceElement);
	});
}
