// Background to main thread: one patch at a time, through `callLepusMethod(PATCH_METHOD, params)`.
// A patch is `{ v, page, items }`, and the main thread runs its items in order, so a call it
// carries never overtakes the ops before it. A call and a reply are written as text when they are
// made, as a cell's ops are, so a value that cannot cross fails at the line that sent it and never
// takes a patch down with it.

import { toText } from "./copy.ts";
import type { MainThreadFunction } from "./main-thread-functions.ts";
import type { Op } from "./ops.ts";
import type { Stamp } from "./page.ts";
import { PROTOCOL_VERSION } from "./page.ts";

/** An error as it crosses between the threads. */
export interface ThrownError {
	/** The error's name, `Error` for a thrown value that is not one. */
	name: string;
	/** Its message, or the thrown value as text. */
	message: string;
	/** Its stack, where it was thrown. */
	stack?: string;
	/** The stable code of a catalogue's message (`hydration_mismatch`), when it has one. */
	code?: string;
}

/** How a call ended: with a value, or with what it threw. */
export type Result = { ok: true; value: unknown } | { ok: false; error: ThrownError };

/**
 * What a call of the patch asks of the main thread, on the call's element or, with the element
 * id 0, on none.
 */
export type CallRequest =
	/** A UI method of the element, with its params: `boundingClientRect`, `scrollTo`… */
	| ["invoke", string, Record<string, unknown>]
	/**
	 * `setValue` of an input or a textarea that answers typing, with the number of the field's
	 * `input` event it answers: the main thread drops it when the field had a newer one. A value set
	 * from code is a plain `invoke`, which always applies.
	 */
	| ["invoke", "setValue", Record<string, unknown>, number]
	/** The value of one of the element's computed styles. */
	| ["computed", string]
	/** The first element under this one that a selector matches. */
	| ["query", string]
	/** Every element under this one that a selector matches. */
	| ["queryAll", string]
	/** No element: the main-thread refs, by id, that the background let go of. */
	| ["unref", number[]]
	/** No element: `runOnMainThread(fn)(...params)`. */
	| ["run", MainThreadFunction, unknown[]];

/** The page's ops, applied now. */
export type OpsItem = ["ops", Op[]];

/**
 * How a cell item marks the whole cell written again:
 *
 * - `true`, the answer to a rewrite or a show message. It replaces the kept text, and a cell Lynx
 *   handed back lets go of its elements; a cell Lynx showed since it was asked for ignores it. A
 *   deferred row's first text comes so, and a cell Lynx waits for is made from it at once.
 * - `"unmount"`, the answer to a rewrite message for a row deferred with `unmountRecycled`: the
 *   same, except that a cell that lets go of its elements, or has none, lets go of its text too,
 *   and the main thread sends a hide message.
 */
export type CellMark = true | "unmount";

/**
 * A list cell's ops, as text from `encodeCell`, with the cell's id. The main thread keeps the text
 * until the list shows the cell. Marked (`CellMark`), it is the whole cell written again; `null`
 * marks nothing. The last member, when there is one, lists the function contexts the text holds
 * (`MainThreadFunction`'s `context`): a text the main thread lets go of unread, it tells the
 * background of, so the background lets go of them too.
 */
export type CellItem =
	| ["cell", number, string]
	| ["cell", number, string, CellMark]
	| ["cell", number, string, CellMark | null, number[]];

/**
 * A call: its id (0 when no reply is wanted), the element's id (0 for none) and the request as
 * text from `encodeCall`.
 */
export type CallItem = ["call", number, number, string];

/**
 * The background's reply to a main-thread function's call of a background function: the call's
 * id and the result as text from `encodeResult`. It rides only in a patch of its call's page.
 */
type ReplyItem = ["reply", number, string];

/**
 * The page is written again: the main thread lets go of its elements, which stay on the screen until
 * the patch's flush, and the items after this make the page again, with the same ids, from what the
 * background holds now. The answer to a rewrite message for the page's root (`ROOT_ID`), the one
 * id this item names; another id is reported, and while the page waits to be written again, the
 * page is asked for again. A list cell is written again as a cell item instead.
 */
export type RewriteItem = ["rewrite", number];

/** One item of a patch. */
export type PatchItem = OpsItem | CellItem | CallItem | ReplyItem | RewriteItem;

/** A patch as the main thread receives it. */
export interface Patch extends Stamp {
	items: PatchItem[];
	/**
	 * The patch shows the page's new data: the main thread flushes it with Lynx's
	 * `triggerDataUpdated`, so a native host's `onDataUpdated` fires.
	 */
	dataUpdated?: true;
	/**
	 * How many of the first items hold the page as its components rendered it, before any of their
	 * effects ran: set on the first patch of a page that starts. The main thread hydrates its first
	 * frame from these items.
	 */
	rendered?: number;
}

/** A patch as the background writes it: the generation its content belongs to, and its items. */
interface PatchOf {
	generation: number;
	items: PatchItem[];
	/** Whether the patch shows the page's new data. */
	dataUpdated?: boolean;
	/** How many of the first items hold the page as it rendered (see `Patch`). */
	rendered?: number | undefined;
}

/** The params `callLepusMethod` passes the main thread's patch function: the patch as text. */
export interface PatchParams {
	data: string;
}

/** A patch as the params of the main thread's patch function, stamped with the format's version. */
export function encodePatch({ generation, items, dataUpdated, rendered }: PatchOf): PatchParams {
	const patch: Patch = { v: PROTOCOL_VERSION, generation, items };
	if (dataUpdated === true) patch.dataUpdated = true;
	if (rendered !== undefined) patch.rendered = rendered;
	return { data: toText(patch, "main-thread") };
}

/** The patch in the params of the main thread's patch function. */
export function decodePatch(params: PatchParams): Patch {
	// Boundary: the text is what `encodePatch` wrote on the other thread.
	return JSON.parse(params.data) as Patch;
}

/** A list cell's ops as the text of a cell item. */
export function encodeCell(ops: Op[]): string {
	return toText(ops, "main-thread");
}

/** The ops of a cell item's text. */
export function decodeCell(text: string): Op[] {
	// Boundary: the text is what `encodeCell` wrote on the other thread.
	return JSON.parse(text) as Op[];
}

/** A call's request as the text of a call item, written when the call is made. */
export function encodeCall(request: CallRequest): string {
	return toText(request, "main-thread");
}

/** The request of a call item's text. */
export function decodeCall(text: string): CallRequest {
	// Boundary: the text is what `encodeCall` wrote on the other thread.
	return JSON.parse(text) as CallRequest;
}

/** A call's result as the text of a reply item, written when the call ends. */
export function encodeResult(result: Result): string {
	return toText(result, "main-thread");
}

/** The result of a reply item's text. */
export function decodeResult(text: string): Result {
	// Boundary: the text is what `encodeResult` wrote on the other thread.
	return JSON.parse(text) as Result;
}

/**
 * A thrown value that is not an `Error`, as the text of a message, as Lynx writes it: a string as
 * it is, anything else as JSON, or as `String` gives it when JSON has none. Different values give
 * different text. Never throws.
 */
export function thrownText(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		const text = JSON.stringify(value);
		if (text !== undefined && text !== "") return text;
	} catch {
		// A cycle or a BigInt: `String` below.
	}
	try {
		return String(value);
	} catch {
		return "A value was thrown that cannot be shown.";
	}
}

/** `error` as an `Error`: a thrown value that is not one is wrapped, with its text as the message. */
export function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(thrownText(error));
}

/** What a thread caught, ready to cross: an error's name, message, stack and code. */
export function encodeError(error: unknown): ThrownError {
	const thrown: ThrownError =
		error instanceof Error
			? { name: error.name, message: error.message }
			: { name: "Error", message: thrownText(error) };
	if (error instanceof Error && typeof error.stack === "string") thrown.stack = error.stack;
	if (typeof error === "object" && error !== null && "code" in error) {
		const { code } = error;
		if (typeof code === "string") thrown.code = code;
	}
	return thrown;
}

/** The error the other thread caught, as an `Error` with its name, message, stack and code. */
export function decodeError(thrown: ThrownError): Error & { code?: string } {
	const error: Error & { code?: string } = new Error(thrown.message);
	error.name = thrown.name;
	if (thrown.stack !== undefined) error.stack = thrown.stack;
	if (thrown.code !== undefined) error.code = thrown.code;
	return error;
}
