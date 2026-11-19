// `fireEvent`: a Lynx event on an element, as Lynx sends it, then a wait until both threads are
// idle (the handler runs on the background, and its update comes back). Async, as
// `@testing-library/svelte`'s is.
//
//   await fireEvent.tap(screen.getByText("Go"));
//   await fireEvent.input(field, { detail: { value: "hi" } });
//   await fireEvent(element, "snap", { detail: { position: 2 } });
//
// The init's fields become the event's (`detail`, `touches`). The touch family travels as Lynx
// sends a touch: captured from the page down, then bubbling up; any other event reaches its element
// only, as a custom event does.

import { testingError } from "../catalogue.ts";
import type { LynxElement } from "../engine/types.ts";
import { rendered, settle } from "./session.ts";
import type { Rendered } from "./session.ts";

/** The init of a Lynx event in `fireEvent`: `bubbles`, `detail`, and any other field the event has. */
export interface LynxEventInit {
	/** Whether the event travels as a touch does: captured, then bubbling. The touch family does. */
	bubbles?: boolean;
	/** The event's `detail`. */
	detail?: unknown;
	[field: string]: unknown;
}

// ReactLynx's list (@lynx-js/react/testing-library's fire-event.ts), and `<input>`'s and
// `<image>`'s events. The touch family bubbles.
const EVENTS = {
	tap: true,
	longtap: true,
	longpress: true,
	touchstart: true,
	touchmove: true,
	touchcancel: true,
	touchend: true,
	bgload: false,
	bgerror: false,
	load: false,
	error: false,
	transitionstart: false,
	transitioncancel: false,
	transitionend: false,
	animationstart: false,
	animationiteration: false,
	animationcancel: false,
	animationend: false,
	mousedown: false,
	mouseup: false,
	mousemove: false,
	mouseclick: false,
	mousedblclick: false,
	mouselongpress: false,
	wheel: false,
	keydown: false,
	keyup: false,
	focus: false,
	blur: false,
	input: false,
	confirm: false,
	selection: false,
	layoutchange: false,
	scrolltoupper: false,
	scrolltolower: false,
	scroll: false,
	scrollend: false,
	contentsizechanged: false,
	scrolltoupperedge: false,
	scrolltoloweredge: false,
	scrolltonormalstate: false,
} as const;

/** The names of the Lynx events `fireEvent` has a shortcut for (`fireEvent.tap`). */
export type LynxEventName = keyof typeof EVENTS;

/** `fireEvent` and its shortcuts. */
export type FireEvent = {
	/**
	 * Fires the Lynx event `event` with `init`, or a DOM event's type and own fields, on `element`,
	 * then waits until both threads are idle. Resolves with `true`: a Lynx event cannot be canceled.
	 */
	(element: Element, event: Event | string, init?: LynxEventInit): Promise<boolean>;
} & { [Name in LynxEventName]: (element: Element, init?: LynxEventInit) => Promise<boolean> };

/** A DOM event as the Lynx event it stands for: its type, whether it bubbles, and its own fields. */
function fromDom(event: Event): { name: string; init: LynxEventInit } {
	const fields: Record<string, unknown> = {};
	for (const key of Object.keys(event))
		if (key !== "isTrusted") fields[key] = Reflect.get(event, key);
	return { name: event.type, init: { ...fields, bubbles: event.bubbles } };
}

/**
 * Whether the event reaches a listener of the background on its way: the first frame's listener of
 * an element whose markup has a handler, which waits for the background (the page's own listen for
 * every event, and main-thread functions are bound otherwise).
 */
function heardByBackground(
	session: Rendered,
	element: Element,
	name: string,
	bubbles: boolean,
): boolean {
	const { engine } = session.page;
	const page = engine.page();
	for (
		let node: Element | null = element;
		node && node !== page;
		node = bubbles ? node.parentElement : null
	) {
		if (engine.state(node).listeners.some((listener) => listener.name === name)) return true;
	}
	return false;
}

async function fire(
	element: Element,
	event: Event | string,
	init?: LynxEventInit,
): Promise<boolean> {
	const session = rendered();
	if (!session) throw testingError({ code: "no_page_rendered", details: { call: "fireEvent" } });
	const { name, init: given } =
		typeof event === "string" ? { name: event, init: init ?? {} } : fromDom(event);
	const { bubbles, ...fields } = given;
	const touch = bubbles ?? (EVENTS as Record<string, boolean>)[name] ?? false;
	const { engine } = session.page;
	if (!session.background && heardByBackground(session, element, name, touch)) {
		session.page.errors.push(
			testingError({
				code: "handler_on_background",
				details: { event: name, tag: element.localName },
			}),
		);
	}
	// Boundary: an element of the page is the engine's.
	const target = element as LynxElement;
	if (touch) engine.dispatch(target, { ...fields, type: name });
	// Lynx sends a custom event only to an element that listens to it.
	else if (engine.hears(target, name)) engine.fire(target, { ...fields, type: name });
	await settle(session);
	return true;
}

/**
 * Fires a Lynx event on an element of the page, then waits until both threads are idle. Each name
 * in `LynxEventName` is also a function: `fireEvent.tap(element)`.
 */
export const fireEvent: FireEvent = Object.assign(
	fire,
	Object.fromEntries(
		Object.keys(EVENTS).map((name) => [
			name,
			(element: Element, init?: LynxEventInit) => fire(element, name, init),
		]),
	) as { [Name in LynxEventName]: (element: Element, init?: LynxEventInit) => Promise<boolean> },
);
