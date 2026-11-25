// Main thread to background: one message at a time, through `lynx.getJSContext().dispatchEvent`,
// as text stamped with the format's version and the page's generation.

import { toText } from "./copy.ts";
import { TO_BACKGROUND } from "./names.ts";
import type { Op } from "./ops.ts";
import type { Stamp } from "./page.ts";
import { PROTOCOL_VERSION } from "./page.ts";
import type { Result, ThrownError } from "./patch.ts";

/** An element as an event names it, with the background's id for it (`element`, 0 for none). */
export interface SentTarget {
	/** The element's `id` attribute, "" when it has none. */
	id?: string;
	/** Lynx's own id of the element. */
	uid?: number;
	/** The element's `data-*` values. */
	dataset?: Record<string, unknown>;
	element: number;
}

/** An event as plain data: Lynx's fields, with its targets named. */
export interface SentEvent {
	[field: string]: unknown;
	target?: SentTarget;
	currentTarget?: SentTarget;
}

/** An element's event, for the background's handler of this id. */
interface EventMessage {
	t: "event";
	handler: number;
	event: SentEvent;
	/**
	 * An `input` event's number, which the main thread counts for each field: a write of the
	 * field's value says which event it answers (`CallRequest`'s `invoke`).
	 */
	input?: number;
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
interface ReplyMessage {
	t: "reply";
	id: number;
	result: Result;
}

/** The function contexts the main thread no longer holds, so the background can let them go. */
interface ReleaseMessage {
	t: "release";
	contexts: number[];
}

/**
 * The main thread asks the background to write subtrees again, with the ids they have. `elements`
 * is the page's root (`ROOT_ID`) alone, after a hydration it refused or could not finish, answered
 * with a rewrite item; or list cells Lynx handed back or whose kept text piled up, each answered
 * with a marked cell item, and an id that is no longer a cell with nothing. `mismatch` says why a
 * hydration was refused, with the values that differ in development builds only.
 */
export interface RewriteMessage {
	t: "rewrite";
	elements: number[];
	mismatch?: HydrationMismatch;
}

/**
 * Lynx asked for these list cells, or will soon, and the main thread has no text for them: rows
 * whose contents are deferred. The background renders their contents and answers each with a cell
 * item marked `true`; an id that is no longer a deferred row with no text sent gets nothing.
 */
export interface ShowMessage {
	t: "show";
	elements: number[];
}

/**
 * The main thread let go of these cells and of their text, after a cell item marked `"unmount"`:
 * the background unmounts the rows' contents, and sends nothing of them until a show message.
 */
export interface HideMessage {
	t: "hide";
	elements: number[];
}

/**
 * What differs between the first frame and the page the background rendered, by the background's
 * ids. `element` is the element where it differs (for an element the background lacks, its parent);
 * `expected` is the background's and `got` the first frame's.
 */
export interface HydrationMismatch {
	kind: "tag" | "missing" | "extra" | "attribute" | "list-keys";
	element: number;
	/** The attribute that differs. */
	name?: string;
	expected?: unknown;
	got?: unknown;
}

/**
 * In a development build, after a hydration: the attributes whose `$props.id()` ids differed
 * between the first frame and the background, outside any `{#if}` branch, which the main thread
 * wrote over the first frame's. A page whose ids agree never sends it.
 */
export interface PropsIdsMessage {
	t: "props-ids";
	differences: PropsIdDifference[];
}

/** An attribute of an element, by the background's id, and its value on each side. */
export interface PropsIdDifference {
	element: number;
	name: string;
	/** The background's value. */
	expected: string;
	/** The first frame's value. */
	got: string;
}

/** Where on the main thread an error was thrown, as far as the main thread knows. */
export interface ErrorPlace {
	/** The component, as its file. */
	component?: string;
	/** The id of the main-thread function that threw, which names its file and its function. */
	mainThreadFunction?: string;
	/** The background's id of the element whose main-thread function threw. */
	element?: number;
}

/**
 * An error the main thread reported into Lynx, for the background's error handler, with where it
 * was thrown. A development build adds the op it could not apply. The throw of a called function
 * travels in its reply instead: this carries what no reply carries.
 */
export interface ErrorMessage {
	t: "error";
	error: ThrownError;
	place?: ErrorPlace;
	op?: Op;
}

/** What the main thread sends the background. */
export type ToBackground =
	| EventMessage
	| CallMessage
	| ReplyMessage
	| ReleaseMessage
	| ErrorMessage
	| RewriteMessage
	| PropsIdsMessage
	| ShowMessage
	| HideMessage;

/** A message to the background as the background receives it. */
export type ReceivedByBackground = ToBackground & Stamp;

/** The event `dispatchEvent` sends: its type, and the message as text. */
export interface ThreadEvent {
	type: string;
	data: string;
}

/**
 * A message to the background as the event to dispatch, stamped with the version and the generation
 * its content belongs to.
 */
export function encodeToBackground(message: ToBackground, generation: number): ThreadEvent {
	const type =
		message.t === "event" || message.t === "call" ? TO_BACKGROUND.events : TO_BACKGROUND.replies;
	const stamped: Stamp = { v: PROTOCOL_VERSION, generation };
	return { type, data: toText(Object.assign(stamped, message), "background") };
}

/** The message in an event the background received. */
export function decodeToBackground(event: { data: unknown }): ReceivedByBackground {
	// Boundary: the text is what `encodeToBackground` wrote on the other thread.
	return JSON.parse(String(event.data)) as ReceivedByBackground;
}
