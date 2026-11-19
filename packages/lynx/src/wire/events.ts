// The event rule: how an attribute written in a component names a Lynx event. A component writes
// `ontap`, `ontapcapture`, `oncatchtap` or `oncatchtapcapture`, and the same four after
// `main-thread:` for a main-thread function; Lynx's own spellings (`bindtap`, `capture-bindtap`,
// `catchtap`, `capture-catchtap`, `global-bindtap`) are refused. The compiler, the renderer and
// the main thread read this one rule.

import { MAIN_THREAD_PREFIX } from "./names.ts";

/** How Lynx binds an event: the type its element functions and the ops carry. */
export type LynxEventType = "bindEvent" | "catchEvent" | "capture-bind" | "capture-catch";

/** An event as Lynx binds it: its type and its name (`tap`). */
export interface LynxListener {
	type: LynxEventType;
	name: string;
}

/** The Lynx event an attribute names, and whether a main-thread function handles it. */
export interface LynxEvent extends LynxListener {
	mainThread: boolean;
}

/**
 * A listener of `on(node, event, handler, { capture })` as Lynx binds it: Svelte has already taken
 * off `on` and a `capture` suffix. A `catch` prefix (`catchtap`) catches the event, as `oncatchtap`
 * does.
 */
export function listenerEvent(event: string, capture: boolean): LynxListener {
	if (event.startsWith("catch") && event.length > "catch".length)
		return { type: capture ? "capture-catch" : "catchEvent", name: event.slice("catch".length) };
	return { type: capture ? "capture-bind" : "bindEvent", name: event };
}

/**
 * The Lynx event an attribute names: `ontap` binds `tap`, `ontapcapture` binds it in the capture
 * phase, `oncatchtap` catches it, `oncatchtapcapture` catches it in the capture phase, and each
 * after `main-thread:` does the same for a main-thread function. Svelte's rule decides what is the
 * capture phase, so `ongotpointercapture` is an event with `capture` in its name. `undefined` for
 * any other attribute, Lynx's own spellings included.
 */
export function eventOf(attribute: string): LynxEvent | undefined {
	const mainThread = attribute.startsWith(MAIN_THREAD_PREFIX);
	const name = mainThread ? attribute.slice(MAIN_THREAD_PREFIX.length) : attribute;
	if (!name.startsWith("on")) return undefined;
	let event = name.slice(2);
	const capture =
		event.endsWith("capture") && event !== "gotpointercapture" && event !== "lostpointercapture";
	if (capture) event = event.slice(0, -"capture".length);
	const { type, name: lynxName } = listenerEvent(event, capture);
	return { type, name: lynxName, mainThread };
}

/** Each name Lynx sends an event under, by the name a component writes. */
const SENT_AS: Readonly<Record<string, readonly string[]>> = {
	/**
	 * An `<overlay>` is asked to close: Android sends `requestclose` for its Back button, iOS sends
	 * `onRequestClose` for a swipe from the screen's edge, and neither sends the other's
	 * (LynxOverlayView.kt, LynxUIOverlay.m). Only an overlay sends either.
	 *
	 * @workaround overlay-request-close kind=lynx-gap delete-when="Lynx sends an overlay's close request under one name on every platform"
	 */
	requestclose: ["requestclose", "onRequestClose"],
};

/**
 * The names Lynx sends an event under, which an element listens to for it: the event's own name,
 * and for an overlay's `requestclose` also iOS's `onRequestClose`.
 */
export function sentNames(name: string): readonly string[] {
	return SENT_AS[name] ?? [name];
}

const SPELLING: Record<LynxEventType, string> = {
	bindEvent: "bind",
	catchEvent: "catch",
	"capture-bind": "capture-bind",
	"capture-catch": "capture-catch",
};

/**
 * Lynx's spelling of an event attribute: `ontap` is `bindtap`, `ontapcapture` is
 * `capture-bindtap`, `oncatchtap` is `catchtap`, `oncatchtapcapture` is `capture-catchtap`, and a
 * `main-thread:` prefix stays. Any other attribute comes back as it is.
 */
export function lynxEventName(attribute: string): string {
	const event = eventOf(attribute);
	if (event === undefined) return attribute;
	return `${event.mainThread ? MAIN_THREAD_PREFIX : ""}${SPELLING[event.type]}${event.name}`;
}

/** An event attribute written in Lynx's own spelling, which a component no longer writes. */
export interface RemovedEventSpelling {
	/** The event's name, as written after the prefix. */
	event: string;
	/** What to write instead, or `undefined` when no attribute replaces it. */
	replacement: string | undefined;
}

const LYNX_SPELLING = /^(capture-bind|capture-catch|global-bind|bind|catch)(.+)$/;

/** What replaces `prefix` followed by `event`: the spelling of the rule above. */
function replacement(prefix: string, event: string): string | undefined {
	switch (prefix) {
		case "bind":
			return `on${event}`;
		case "catch":
			return `oncatch${event}`;
		case "capture-bind":
			return `on${event}capture`;
		case "capture-catch":
			return `oncatch${event}capture`;
		default:
			// `global-bind`: a listener on the page's root is `on(root, …)`.
			return undefined;
	}
}

/**
 * What a component writes in place of an attribute in Lynx's own spelling: `bindtap` is `ontap`,
 * `catchtap` is `oncatchtap`, `capture-bindtap` is `ontapcapture`, `capture-catchtap` is
 * `oncatchtapcapture`, each keeping a `main-thread:` prefix, and `global-bindtap` has no
 * attribute. `undefined` for any other name.
 */
export function removedEventSpelling(attribute: string): RemovedEventSpelling | undefined {
	const prefix = attribute.startsWith(MAIN_THREAD_PREFIX) ? MAIN_THREAD_PREFIX : "";
	const match = LYNX_SPELLING.exec(attribute.slice(prefix.length));
	if (match === null) return undefined;
	// Boundary: a match of this pattern always has both groups, which the type calls optional.
	const [, spelling, event] = match as unknown as [string, string, string];
	const written = replacement(spelling, event);
	return { event, replacement: written === undefined ? undefined : prefix + written };
}
