import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";
import type { Attachment } from "svelte/attachments";

import { attachmentProps, contains, getTarget, type WebTypes } from "../kernel/index.js";
import { closeOnEscape } from "./dismiss-escape.js";
import { PRESS_EVENTS } from "./dismiss-inside-marker.js";
import type { DismissPopup } from "./dismiss-types.js";

/**
 * The Popup part's side of dismissal: Escape while the popup has focus, and the markers that
 * tell the dismissal a press began in the popup or passed through it.
 */
export function useDismissPopup(popup: PopupView<WebTypes>): DismissPopup {
	const dismiss = popup.dismiss;

	// A press on the popup whose default was prevented (a drag handle) may make no click.
	function onPressStart(event: PointerEvent | MouseEvent) {
		if (event.defaultPrevented) {
			dismiss.pressStartPrevented();
		}
	}

	// Native capture listeners on the popup element, attached as soon as it exists (Svelte defers
	// spread pointer listeners, and `on`'s, by a microtask).
	const attachInsideMarkers: Attachment<HTMLElement> = (element) => {
		const mark = () => dismiss.markInside();
		const onPress = (event: Event) => {
			dismiss.markInside();
			// Only presses that start in the popup's own subtree count (not nested portals).
			dismiss.pressStart(
				(event as PointerEvent).button,
				contains(popup.positionerElement, getTarget(event) as Element | null),
			);
		};
		const listenerOf = (type: string) =>
			type === "mousedown" || type === "pointerdown" ? onPress : mark;
		for (const type of PRESS_EVENTS) {
			element.addEventListener(type, listenerOf(type), true);
		}
		return () => {
			for (const type of PRESS_EVENTS) {
				element.removeEventListener(type, listenerOf(type), true);
			}
		};
	};

	return {
		props: {
			onkeydown: (event: KeyboardEvent) => closeOnEscape(popup, event),
			onpointerdown: onPressStart,
			onmousedown: onPressStart,
			...attachmentProps(attachInsideMarkers),
		},
	};
}
