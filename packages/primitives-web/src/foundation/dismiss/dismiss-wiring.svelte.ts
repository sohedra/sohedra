import type {
	OutsidePress,
	TouchPoint,
} from "@sohedra/primitives-core/foundation/dismiss/index.js";
import type { OpenChangeDetails } from "@sohedra/primitives-core/foundation/popup/index.js";
import { untrack } from "svelte";
import { type Attachment, createAttachmentKey } from "svelte/attachments";

import {
	contains,
	getInteractionEventType,
	getPointerType,
	getTarget,
	isVirtualClick,
	ownerDocument,
	userAgent,
	type WebTypes,
} from "../kernel/index.js";
import {
	addTargetListenerOnce,
	isEventWithinFloatingTree,
	isEventWithinOwnElements,
	isSparedPressTarget,
	PRESS_EVENTS,
} from "./dismiss-press-target.js";
import type {
	DismissPopup,
	DismissPopupView,
	DismissTrigger,
	DismissTriggerView,
	DismissView,
} from "./dismiss-types.js";

type Listener = [string, EventListener, AddEventListenerOptions | boolean];

// Events whose propagation a dismissal stopped: other popups' document listeners (on the same
// node as Svelte's delegation root) must not handle them again. Module-level: one event is seen
// by every popup on the page. A popup that still runs the old dismiss wiring keeps its own set;
// both also read the event's `cancelBubble`, which a stopped event carries either way.
const stoppedEvents = new WeakSet<Event>();

/** Escape on the popup, a trigger or the page: closes the popup unless something else owns the key. */
function closeOnEscape(popup: DismissTriggerView, event: KeyboardEvent): void {
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

function touchPoint(event: TouchEvent): TouchPoint | null {
	const touch = event.touches[0];
	return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * The Root's side of dismissal: while the popup is open, the document listeners that see Escape
 * and every press, and tell the popup's dismissal where each landed. It installs them when
 * called (once, while the Root initialises).
 */
export function useDismiss(popup: DismissView): void {
	const dismiss = popup.dismiss;
	// Compared by value: the listeners are set up again only when the answer changes, not whenever
	// something the popup's kind reads for it does.
	const enabled = $derived(dismiss.enabled);

	/**
	 * A press as the dismissal is told of it. Where it landed is worked out when the dismissal
	 * reads it, while the event is still being dispatched.
	 */
	function toPress(event: MouseEvent | PointerEvent | TouchEvent): OutsidePress<WebTypes> {
		return {
			event,
			eventType: getInteractionEventType(event),
			get inOwnElements() {
				return isEventWithinOwnElements(popup, event);
			},
			get pressBacked() {
				return (event as MouseEvent).detail !== 0 && !isVirtualClick(event as MouseEvent);
			},
			get spared() {
				return isSparedPressTarget(popup, event);
			},
		};
	}

	function onPressCapture(event: PointerEvent | MouseEvent) {
		// Only `pointerdown` marks a press (`mousedown` is its compatibility event).
		const followed = dismiss.pressSeen({
			button: event.button,
			pointerType: event.type === "pointerdown" ? getPointerType(event) : undefined,
			compatibility: event.type === "mousedown",
		});
		if (!followed) {
			return;
		}
		addTargetListenerOnce(event, (targetEvent) => {
			if (targetEvent.type === "pointerdown") {
				dismiss.pointerPress(
					toPress(targetEvent),
					(targetEvent as PointerEvent).pointerType === "touch",
				);
			} else {
				dismiss.press(toPress(targetEvent));
			}
		});
	}

	function onPressEndCapture(event: PointerEvent | MouseEvent) {
		dismiss.pressEnd({
			canceled: event.type === "pointercancel",
			get endedInTree() {
				return isEventWithinFloatingTree(popup, event);
			},
		});
	}

	function onTouchStartCapture(event: TouchEvent) {
		dismiss.touchSeen();
		addTargetListenerOnce(event, (targetEvent) => {
			dismiss.touchStart(touchPoint(targetEvent), isEventWithinOwnElements(popup, targetEvent));
		});
	}

	const passiveCapture = { capture: true, passive: true };
	const pressListeners: Listener[] = [
		["click", onPressCapture as EventListener, true],
		["pointerdown", onPressCapture as EventListener, true],
		["pointerup", onPressEndCapture as EventListener, true],
		["pointercancel", onPressEndCapture as EventListener, true],
		["mousedown", onPressCapture as EventListener, true],
		["mouseup", onPressEndCapture as EventListener, true],
		["touchstart", onTouchStartCapture as EventListener, passiveCapture],
		[
			"touchmove",
			((event: TouchEvent) =>
				addTargetListenerOnce(event, (targetEvent) =>
					dismiss.touchMove(touchPoint(targetEvent), toPress(targetEvent)),
				)) as EventListener,
			passiveCapture,
		],
		[
			"touchend",
			((event: TouchEvent) =>
				addTargetListenerOnce(event, (targetEvent) =>
					dismiss.touchEnd(toPress(targetEvent)),
				)) as EventListener,
			passiveCapture,
		],
	];
	const keyListeners: Listener[] = [
		["keydown", ((event: KeyboardEvent) => closeOnEscape(popup, event)) as EventListener, false],
		// WORKAROUND(safari): Safari fires `compositionend` before the `keydown` that ended the
		// composition, so it counts a little longer there (5ms works in WebKit). Remove when the
		// order matches the other engines.
		["compositionend", () => dismiss.compositionEnd(userAgent.engine.webkit ? 5 : 0), false],
	];

	// A same-flush close and reopen never renders closed; only the open-change event sees it.
	$effect(() => {
		const onOpenChange = (details: OpenChangeDetails<WebTypes>) => {
			if (!details.open) {
				dismiss.closed();
			}
		};
		popup.events.on("openchange", onOpenChange);
		return () => popup.events.off("openchange", onOpenChange);
	});

	// The Root unmounted: drops the dismissal's timers.
	$effect(() => () => dismiss.dispose());

	// The document listeners while the popup is open and its dismissal is on.
	$effect(() => {
		const open = popup.open;
		const isEnabled = enabled;
		const floating = popup.floatingElement;
		if (!open || !isEnabled) {
			// Reset in the body, not the cleanup, which also runs mid-gesture on dependency changes.
			if (!open) {
				dismiss.reset();
			}
			// Cleared when this closed state ends, not now: a close made while focus moves out (a
			// trigger's focus guard) leaves the focus behaviour's pending focus-out check to read it.
			return dismiss.clearInside;
		}
		const doc = ownerDocument(floating);
		const listeners = [...keyListeners, ...pressListeners];
		for (const [type, listener, listenerOptions] of listeners) {
			doc.addEventListener(type, listener, listenerOptions);
		}
		return () => {
			for (const [type, listener, listenerOptions] of listeners) {
				doc.removeEventListener(type, listener, listenerOptions);
			}
			untrack(() => dismiss.release());
		};
	});
}

/**
 * The Popup part's side of dismissal: Escape while the popup has focus, and the markers that
 * tell the dismissal a press began in the popup or passed through it.
 */
export function useDismissPopup(popup: DismissPopupView): DismissPopup {
	const dismiss = popup.dismiss;

	// A press on the popup whose default was prevented (a drag handle) may make no click.
	function onPressStart(event: PointerEvent | MouseEvent) {
		if (event.defaultPrevented) {
			dismiss.pressStartPrevented();
		}
	}

	// Native capture listeners on the popup element, attached as soon as it exists (Svelte defers
	// spread pointer listeners by a microtask).
	const attachInsideMarkers: Attachment<HTMLElement> = (element) => {
		const mark = () => dismiss.markInside();
		const onPress = (event: Event) => {
			dismiss.markInside();
			// Only presses that start in the popup's own subtree count (not nested portals).
			dismiss.pressStart(
				(event as PointerEvent).button,
				contains(popup.floatingElement, getTarget(event) as Element | null),
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
			onkeydown: (event) => closeOnEscape(popup, event),
			onpointerdown: onPressStart,
			onmousedown: onPressStart,
			[createAttachmentKey()]: attachInsideMarkers,
		},
	};
}

/**
 * A trigger's side of dismissal: Escape while the trigger has focus. `getPopup` is asked on each
 * event: a detached trigger's popup can change.
 */
export function useDismissTrigger(getPopup: () => DismissTriggerView): DismissTrigger {
	const onkeydown = (event: KeyboardEvent) => closeOnEscape(getPopup(), event);
	return { props: { onkeydown } };
}
