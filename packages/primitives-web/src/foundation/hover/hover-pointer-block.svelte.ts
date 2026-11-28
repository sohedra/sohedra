import {
	isHoverOpenEvent,
	isMouseLikePointerType,
} from "@sohedra/primitives-core/foundation/hover/index.js";
import { untrack } from "svelte";

import { closest, isElement, ownerDocument } from "../kernel/index.js";
import type { HoverPopupView } from "./hover-types.js";

// The element whose pointer input is blocked, by the hover state that blocked it: one block
// per scope. Module-level: the page has one pointer.
const pointerBlockOwners = new WeakMap<Element, HoverPopupView["hover"]>();

/**
 * Blocks pointer input in `scope` except on the trigger and the popup, so the items the pointer
 * crosses on its way to a submenu don't react.
 */
export function blockPointerEventsOutside(
	popup: HoverPopupView,
	scope: HTMLElement | SVGSVGElement,
	reference: HTMLElement | SVGSVGElement,
	floating: HTMLElement,
): void {
	const hover = popup.hover;
	const owner = pointerBlockOwners.get(scope);
	if (owner && owner !== hover) {
		owner.clearPointerBlock();
	}
	// Its own previous block goes first: replacing it afterwards would undo the styles just set on
	// a shared scope.
	hover.clearPointerBlock();
	pointerBlockOwners.set(scope, hover);
	scope.style.pointerEvents = "none";
	reference.style.pointerEvents = "auto";
	floating.style.pointerEvents = "auto";
	hover.setPointerBlock({
		dispose() {
			if (pointerBlockOwners.get(scope) === hover) {
				scope.style.removeProperty("pointer-events");
				reference.style.removeProperty("pointer-events");
				floating.style.removeProperty("pointer-events");
				pointerBlockOwners.delete(scope);
			}
		},
	});
}

/**
 * The pointer moves over another trigger of an open popup that blocks pointer input: only that
 * trigger and the popup take pointer input on the page.
 */
export function blockPointerEventsOverTrigger(
	popup: HoverPopupView,
	trigger: HTMLElement,
	mouseOnly: boolean,
): void {
	const floating = popup.floatingElement as HTMLElement | null;
	if (mouseOnly && !isMouseLikePointerType(popup.hover.pointerType)) {
		return;
	}
	if (popup.open && popup.hover.blockPointerEvents && floating) {
		blockPointerEventsOutside(popup, trigger.ownerDocument.body, trigger, floating);
	}
}

/**
 * While a hover-opened popup that blocks pointer input is open, only it and its trigger take
 * pointer input in `scope` when it gives one, else the enclosing popup (the menu tree's popup
 * holding the trigger), or the page. Call once during the Popup part's init.
 */
export function usePointerBlock(
	popup: HoverPopupView,
	enabled: () => boolean,
	scope: () => HTMLElement | null = () => null,
): void {
	// The block lasts while the popup is open with a hover; a close or a change of trigger lifts it.
	$effect(() => {
		const floating = popup.floatingElement as HTMLElement | null;
		const reference = popup.anchorElement;
		if (!enabled() || !popup.open || !floating || !isElement(reference)) {
			return;
		}
		untrack(() => {
			if (!popup.hover.blockPointerEvents || !isHoverOpenEvent(popup.data.openEventType)) {
				return;
			}
			// A kept-mounted popup's own element never scopes the block.
			const blocked =
				scope() ??
				(closest(reference, "[data-rootownerid]") as HTMLElement | null) ??
				ownerDocument(floating).body;
			blockPointerEventsOutside(popup, blocked, reference as HTMLElement, floating);
		});
		return () => popup.hover.clearPointerBlock();
	});
}
