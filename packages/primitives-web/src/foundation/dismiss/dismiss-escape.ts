// Escape on a popup, its trigger or the page: the one handler every side of dismissal shares.

import type { PopupView } from "@sohedra/primitives-core/foundation/popup";

import type { WebTypes } from "../kernel/index.js";

// Events whose propagation a dismissal stopped, so other popups' document listeners (beside
// Svelte's delegation root) skip them; each also reads `cancelBubble`. Module-level: one event is
// seen by every popup on the page.
const stoppedEvents = new WeakSet<Event>();

/** Escape on the popup, a trigger or the page: closes the popup unless something else owns the key. */
export function closeOnEscape(popup: PopupView<WebTypes>, event: KeyboardEvent): void {
	if (stoppedEvents.has(event) || event.cancelBubble || event.key !== "Escape") {
		return;
	}
	const outcome = popup.dismiss.escape(event, event.isComposing || event.keyCode === 229);
	if (!outcome) {
		return;
	}
	if (outcome.preventDefault) {
		event.preventDefault();
	}
	if (outcome.stopPropagation) {
		event.stopPropagation();
		stoppedEvents.add(event);
	}
}
