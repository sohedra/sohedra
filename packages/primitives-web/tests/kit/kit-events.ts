// Synthetic events, for what no real input produces (an event sequence, a click count, a pointer
// type, a key state). Each is dispatched bubbling and composed, and Svelte's updates are applied
// after it, so the next event meets what this one rendered.
import { flushSync } from "svelte";
import type { Locator } from "vitest/browser";

type Init = PointerEventInit & KeyboardEventInit & CompositionEventInit & FocusEventInit;

/** Events that neither bubble nor can be cancelled, as the browser sends them. */
const NOT_BUBBLING = new Set(["mouseenter", "mouseleave", "pointerenter", "pointerleave"]);
const NOT_CANCELABLE = new Set([...NOT_BUBBLING, "pointercancel", "focusin", "focusout"]);

function create(type: string, init: Init): Event {
	const options: Init = {
		bubbles: !NOT_BUBBLING.has(type),
		cancelable: !NOT_CANCELABLE.has(type),
		composed: true,
		...init,
	};
	if (type.startsWith("pointer")) return new PointerEvent(type, options);
	if (type.startsWith("mouse") || type === "click" || type === "contextmenu") {
		return new MouseEvent(type, options);
	}
	if (type.startsWith("key")) return new KeyboardEvent(type, options);
	if (type.startsWith("composition")) return new CompositionEvent(type, options);
	if (type.startsWith("focus")) return new FocusEvent(type, options);
	return new Event(type, options);
}

/**
 * Dispatches a `type` event with `init` at `target` (or dispatches `event` as it is), then
 * applies Svelte's pending updates. Returns `false` when a listener cancelled it.
 */
export function dispatch(target: EventTarget | Locator, type: string, init?: Init): boolean;
export function dispatch(target: EventTarget | Locator, event: Event): boolean;
export function dispatch(
	target: EventTarget | Locator,
	typeOrEvent: string | Event,
	init: Init = {},
): boolean {
	const element = "element" in target ? target.element() : target;
	const event = typeof typeOrEvent === "string" ? create(typeOrEvent, init) : typeOrEvent;
	const result = element.dispatchEvent(event);
	flushSync();
	return result;
}
