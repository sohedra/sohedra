// Main thread to background: one message at a time, through `lynx.getJSContext().dispatchEvent`,
// as text stamped with the format's version and the page.

import { TO_BACKGROUND } from "./names.ts";
import type { Op } from "./ops.ts";
import type { Stamp } from "./page.ts";
import { PROTOCOL_VERSION } from "./page.ts";
import type { Result, ThrownError } from "./patch.ts";

/** An element as an event names it, with the background's id for it (`node`, 0 for none). */
export interface SentTarget {
	/** The element's `id` attribute, "" when it has none. */
	id?: string;
	/** Lynx's own id of the element. */
	uid?: number;
	/** The element's `data-*` values. */
	dataset?: Record<string, unknown>;
	node: number;
}

/** An event as plain data: Lynx's fields, with its targets named. */
export interface SentEvent {
	[field: string]: unknown;
	target?: SentTarget;
	currentTarget?: SentTarget;
}

/** An element's event, for the background's handler of this id. */
export interface EventMessage {
	t: "event";
	handler: number;
	event: SentEvent;
}

/**
 * A main-thread function's call of a background function: the function's id, the id the
 * background gave the copy that holds it (`context`), and the arguments. Answered by a reply item
 * of a patch.
 */
export interface CallMessage {
	t: "call";
	id: number;
	fn: number;
	context: number;
	params: unknown[];
}

/** The answer to a call of a patch, by the call's id. */
export interface ReplyMessage {
	t: "reply";
	id: number;
	result: Result;
}

/** The function contexts the main thread no longer holds, so the background can let them go. */
export interface ReleaseMessage {
	t: "release";
	contexts: number[];
}

/**
 * An error the main thread reported into Lynx, for the background's error handler. A development
 * build adds the op it could not apply.
 */
export interface ErrorMessage {
	t: "error";
	error: ThrownError;
	op?: Op;
}

/** What the main thread sends the background. */
export type ToBackground =
	| EventMessage
	| CallMessage
	| ReplyMessage
	| ReleaseMessage
	| ErrorMessage;

/** A message to the background as the background receives it. */
export type ReceivedByBackground = ToBackground & Stamp;

/** The event `dispatchEvent` sends: its type, and the message as text. */
export interface ThreadEvent {
	type: string;
	data: string;
}

/** A message to the background as the event to dispatch, stamped with the version and the page. */
export function encodeToBackground(message: ToBackground, page: number): ThreadEvent {
	const type =
		message.t === "event" || message.t === "call" ? TO_BACKGROUND.events : TO_BACKGROUND.replies;
	const stamped: Stamp = { v: PROTOCOL_VERSION, page };
	return { type, data: JSON.stringify(Object.assign(stamped, message)) };
}

/** The message in an event the background received. */
export function decodeToBackground(event: { data: unknown }): ReceivedByBackground {
	// Boundary: the text is what `encodeToBackground` wrote on the other thread.
	return JSON.parse(String(event.data)) as ReceivedByBackground;
}
