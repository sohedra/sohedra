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
 * A list cell's ops, as text from `encodeCell`, with the cell's id. The main thread keeps the text
 * until the list shows the cell. Marked `true`, it is the whole cell written again, the answer to a
 * rewrite message: it replaces the kept text, and a cell Lynx handed back lets go of its elements;
 * a cell Lynx showed since it was asked for ignores it.
 */
export type CellItem = ["cell", number, string] | ["cell", number, string, true];

/**
 * A call: its id (0 when no reply is wanted), the element's id (0 for none) and the request as
 * text from `encodeCall`.
 */
export type CallItem = ["call", number, number, string];

/**
 * The background's reply to a main-thread function's call of a background function: the call's
 * id and the result as text from `encodeResult`. It rides only in a patch of its call's page.
 */
export type ReplyItem = ["reply", number, string];

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

/** A patch as the background writes it: the page its content belongs to, and its items. */
export interface PatchOf {
	page: number;
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
export function encodePatch({ page, items, dataUpdated, rendered }: PatchOf): PatchParams {
	const patch: Patch = { v: PROTOCOL_VERSION, page, items };
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

/** A thrown value that is not an `Error`, as the text of a message. Never throws. */
function describeThrown(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		if (typeof value === "object" && value !== null) {
			const text = JSON.stringify(value);
			if (text !== undefined) return text;
		}
		return String(value);
	} catch {
		return "A value was thrown that cannot be shown.";
	}
}

/** What a thread caught, ready to cross: an error's name, message, stack and code. */
export function encodeError(error: unknown): ThrownError {
	const thrown: ThrownError =
		error instanceof Error
			? { name: error.name, message: error.message }
			: { name: "Error", message: describeThrown(error) };
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
