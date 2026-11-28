import type { OutsidePress } from "@sohedra/primitives-core/foundation/dismiss";
import type { Point } from "@sohedra/primitives-core/foundation/kernel";
import type { PopupView } from "@sohedra/primitives-core/foundation/popup";
import { on } from "svelte/events";

import {
	getInteractionEventType,
	getPointerType,
	getTarget,
	isVirtualClick,
	ownerDocument,
	userAgent,
	type WebTypes,
} from "../kernel/index.js";
import { closeOnEscape } from "./dismiss-escape.js";
import {
	isEventWithinPopupTree,
	isEventWithinOwnElements,
	isSparedPressTarget,
} from "./dismiss-press-target.js";

/**
 * Runs `listener` once `event` reaches its target. A stopped event never arrives: the next event
 * of its type at the target only ends the wait. Native, because it is added while the event is
 * on its way and `on` would add a pointer or touch listener a microtask late.
 */
function addTargetListenerOnce<E extends Event>(event: E, listener: (event: E) => void) {
	const target = getTarget(event);
	if (!target) {
		return;
	}
	const handle = (arrived: Event) => {
		target.removeEventListener(event.type, handle);
		if (arrived === event) {
			listener(event);
		}
	};
	target.addEventListener(event.type, handle);
}

function touchPoint(event: TouchEvent): Point | null {
	const touch = event.touches[0];
	return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * The Root's side of dismissal: while the popup is open, the document listeners that see Escape
 * and every press, and tell the popup's dismissal where each landed. It installs them when
 * called (once, while the Root initialises).
 */
export function useDismissRoot(popup: PopupView<WebTypes>): void {
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
				return isEventWithinPopupTree(popup, event);
			},
		});
	}

	function onTouchStartCapture(event: TouchEvent) {
		dismiss.touchSeen();
		addTargetListenerOnce(event, (targetEvent) => {
			dismiss.touchStart(touchPoint(targetEvent), isEventWithinOwnElements(popup, targetEvent));
		});
	}

	function onTouchMoveCapture(event: TouchEvent) {
		addTargetListenerOnce(event, (targetEvent) =>
			dismiss.touchMove(touchPoint(targetEvent), toPress(targetEvent)),
		);
	}

	function onTouchEndCapture(event: TouchEvent) {
		addTargetListenerOnce(event, (targetEvent) => dismiss.touchEnd(toPress(targetEvent)));
	}

	// The document listeners while the popup is open and its dismissal is on. The bookkeeping
	// around them (a close, the Root going away) is the dismissal's own, in its `connect()`.
	$effect(() => {
		const open = popup.open;
		const isEnabled = enabled;
		const positioner = popup.positionerElement;
		if (!open || !isEnabled) {
			return;
		}
		const doc = ownerDocument(positioner);
		const capture = { capture: true };
		const passiveCapture = { capture: true, passive: true };
		const offs = [
			on(doc, "keydown", (event) => closeOnEscape(popup, event)),
			// WORKAROUND(safari): Safari fires `compositionend` before the `keydown` that ended the
			// composition, so it counts a little longer there (5ms works in WebKit). Remove when the
			// order matches the other engines.
			on(doc, "compositionend", () => dismiss.compositionEnd(userAgent.engine.webkit ? 5 : 0)),
			on(doc, "click", onPressCapture, capture),
			on(doc, "pointerdown", onPressCapture, capture),
			on(doc, "pointerup", onPressEndCapture, capture),
			on(doc, "pointercancel", onPressEndCapture, capture),
			on(doc, "mousedown", onPressCapture, capture),
			on(doc, "mouseup", onPressEndCapture, capture),
			on(doc, "touchstart", onTouchStartCapture, passiveCapture),
			on(doc, "touchmove", onTouchMoveCapture, passiveCapture),
			on(doc, "touchend", onTouchEndCapture, passiveCapture),
		];
		return () => {
			for (const off of offs) {
				off();
			}
			dismiss.listeningStopped();
		};
	});
}
