import type {
	InteractionEventType,
	PointerType,
	SohedraEvent,
} from "@sohedra/primitives-core/foundation/kernel";

import { userAgent } from "./kernel-user-agent.js";

/**
 * The web's mapping of a native event onto core's event types: core spells them as the web
 * does, so a type core interprets passes on as it is, and any other is `undefined`.
 */
export function getInteractionEventType(event: Event): InteractionEventType | undefined {
	switch (event.type) {
		case "click":
		case "mousedown":
		case "keydown":
		case "keyup":
		case "mouseenter":
		case "mousemove":
			return event.type;
		default:
			return undefined;
	}
}

/**
 * The web's mapping of an event's pointer type onto core's: `mouse`, `pen` and `touch` pass on as
 * they are; an empty, missing (a `MouseEvent` click) or non-standard one is `""`, a device the
 * browser can't tell.
 */
export function getPointerType(event: Event): PointerType {
	const type = (event as PointerEvent).pointerType;
	return type === "mouse" || type === "pen" || type === "touch" ? type : "";
}

/** Prevents the event's default and stops its propagation. */
export function stopEvent(event: Event): void {
	event.preventDefault();
	event.stopPropagation();
}

/** A click made without a pointer: keyboard, assistive technology or `element.click()`. */
export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
	if ((event as PointerEvent).pointerType === "" && event.isTrusted) {
		return true;
	}
	// WORKAROUND(android): a screen reader's click on Android carries a pointer type, so there a
	// virtual click is a `click` with the primary button down. Remove when Android sends none.
	if (userAgent.os.android && (event as PointerEvent).pointerType) {
		return event.type === "click" && event.buttons === 1;
	}
	return event.detail === 0 && !(event as PointerEvent).pointerType;
}

/** A pointer event a screen reader synthesized. */
export function isVirtualPointerEvent(event: PointerEvent): boolean {
	// WORKAROUND(android): Android's real presses can report a zero size and its screen reader's a
	// pressed button, so both size tests skip it there. Remove when Android reports them apart.
	return (
		(!userAgent.os.android && event.width === 0 && event.height === 0) ||
		(event.type === "pointerdown" &&
			event.width === 1 &&
			event.height === 1 &&
			event.pressure === 0 &&
			event.detail === 0 &&
			event.pointerType === "mouse" &&
			(userAgent.os.android || event.buttons === 0)) ||
		(event.width < 1 &&
			event.height < 1 &&
			event.pressure === 0 &&
			event.detail === 0 &&
			event.pointerType === "touch")
	);
}

/** The event change details carry when there is no native event. */
export function fallbackEvent(): Event {
	return new Event("sohedra");
}

/** Adds `preventSohedraHandler()` to an event, for handlers that call user handlers themselves. */
export function makeEventPreventable<E extends Event>(event: E): SohedraEvent<E> {
	const preventable = event as SohedraEvent<E> & { sohedraHandlerPrevented?: boolean };
	preventable.preventSohedraHandler = () => {
		preventable.sohedraHandlerPrevented = true;
	};
	return preventable;
}
