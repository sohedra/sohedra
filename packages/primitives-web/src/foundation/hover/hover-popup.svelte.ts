import { HoverPopupStore } from "@sohedra/primitives-core/foundation/hover";
import type { PopupView } from "@sohedra/primitives-core/foundation/popup";
import { flushSync } from "svelte";
import { on } from "svelte/events";

import {
	closest,
	contains,
	getTarget,
	isElement,
	TYPEABLE_SELECTOR,
	type WebTypes,
} from "../kernel/index.js";
import { isInsideEnabledTrigger } from "./hover-trigger.svelte.js";
import type { HoverPopupOptions } from "./hover-types.js";

const INTERACTIVE_SELECTOR = `button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`;

/** Whether `element` is (inside) something a press activates or types into. */
function isInteractiveElement(element: Element | null): boolean {
	return closest(element, INTERACTIVE_SELECTOR) != null;
}

/**
 * The popup side of a popup's hover: keeps a hover-opened popup open while the pointer is over
 * it, and closes it when the pointer leaves. Call once, while the Popup part initialises.
 *
 * `popup` is the popup's store; `options` returns the Popup's hover options as a plain object.
 */
export function useHoverPopup(popup: PopupView<WebTypes>, options: () => HoverPopupOptions): void {
	const hover = new HoverPopupStore<WebTypes>(options, { popup, flush: flushSync });

	// Value-compared: the listeners are installed again only when this changes.
	const enabled = $derived(options().enabled);

	// The pointer entering, leaving and pressing inside the popup's positioned element.
	$effect(() => {
		const positioner = popup.positionerElement as HTMLElement | null;
		if (!enabled || !positioner) {
			return;
		}
		const tree = popup.tree;

		function onInteractInside(event: PointerEvent) {
			const target = getTarget(event) as Element | null;
			const interactive = isInteractiveElement(target);
			hover.pressInside(interactive, interactive && closest(target, "[aria-haspopup]") != null);
		}

		function onMouseLeave(event: MouseEvent) {
			const relatedTarget = event.relatedTarget;
			hover.leave(event, {
				enabledTrigger: isInsideEnabledTrigger(relatedTarget, popup.triggers),
				descendant: Boolean(
					tree &&
					isElement(relatedTarget) &&
					tree
						.children(popup.nodeId, false)
						.some((node) => contains(node.context?.positionerElement, relatedTarget)),
				),
			});
		}

		const offs = [
			on(positioner, "mouseenter", () => hover.enter()),
			on(positioner, "mouseleave", onMouseLeave),
			on(positioner, "pointerdown", onInteractInside, { capture: true }),
		];
		return () => {
			for (const off of offs) {
				off();
			}
			hover.stop();
		};
	});
}
