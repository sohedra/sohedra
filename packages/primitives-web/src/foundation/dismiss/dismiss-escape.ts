// Escape on a popup, its trigger or the page: the one handler every side of dismissal shares.

import type { DismissTriggerView } from "./dismiss-types.js";

// Events whose propagation a dismissal stopped: other popups' document listeners (on the same
// node as Svelte's delegation root) must not handle them again. Module-level: one event is seen
// by every popup on the page. A popup that still runs the old dismiss wiring keeps its own set;
// both also read the event's `cancelBubble`, which a stopped event carries either way.
const stoppedEvents = new WeakSet<Event>();

/** Escape on the popup, a trigger or the page: closes the popup unless something else owns the key. */
export function closeOnEscape(popup: DismissTriggerView, event: KeyboardEvent): void {
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
