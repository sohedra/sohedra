// Background to main thread: one patch at a time, through `callLepusMethod(PATCH_METHOD, params)`.
// A patch is `{ v, page, items }`, and the main thread runs its items in order, so a call it
// carries never overtakes the ops before it.

import type { MainThreadFunction } from "./main-thread-functions.ts";
import type { Op } from "./ops.ts";
import type { Stamp } from "./page.ts";
import { PROTOCOL_VERSION } from "./page.ts";

/** An error as it crosses between the threads. */
export interface ThrownError {
	name: string;
	message: string;
	stack?: string;
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
	/** Styles set from code; a value of `null` removes one. */
	| ["style", Record<string, string | number | null>]
	/** The value of one of the element's computed styles. */
	| ["computed", string]
	/** The first element under this one that a selector matches. */
	| ["query", string]
	/** Every element under this one that a selector matches. */
	| ["queryAll", string]
	/** An animation of the element: Lynx's operation and its arguments. */
	| ["animate", unknown[]]
	/** No element: the main-thread refs, by id, that the background let go of. */
	| ["unref", number[]]
	/** No element: `runOnMainThread(fn)(...params)`. */
	| ["run", MainThreadFunction, unknown[]]
	/** No element: prepare the main-thread part of a lazy bundle the background loaded, by URL. */
	| ["lazy-bundle", string];

/** The page's ops, applied now. */
export type OpsItem = ["ops", Op[]];

/**
 * A list cell's ops, as text from `encodeCell`, with the cell's id. The main thread keeps the text
 * until the list shows the cell.
 */
export type CellItem = ["cell", number, string];

/** A call: its id (0 when no reply is wanted), the element's id (0 for none) and the request. */
export type CallItem = ["call", number, number, CallRequest];

/** The background's reply to a main-thread function's call of a background function, by its id. */
export type ReplyItem = ["reply", number, Result];

/** One item of a patch. */
export type PatchItem = OpsItem | CellItem | CallItem | ReplyItem;

/** A patch as the main thread receives it. */
export interface Patch extends Stamp {
	items: PatchItem[];
}

/** A patch as the background writes it: the page it belongs to, and its items. */
export interface PatchOf {
	page: number;
	items: PatchItem[];
}

/** The params `callLepusMethod` passes the main thread's patch function: the patch as text. */
export interface PatchParams {
	data: string;
}

/** A patch as the params of the main thread's patch function, stamped with the format's version. */
export function encodePatch({ page, items }: PatchOf): PatchParams {
	return { data: JSON.stringify({ v: PROTOCOL_VERSION, page, items }) };
}

/** The patch in the params of the main thread's patch function. */
export function decodePatch(params: PatchParams): Patch {
	// Boundary: the text is what `encodePatch` wrote on the other thread.
	return JSON.parse(params.data) as Patch;
}

/** A list cell's ops as the text of a cell item. */
export function encodeCell(ops: Op[]): string {
	return JSON.stringify(ops);
}

/** The ops of a cell item's text. */
export function decodeCell(text: string): Op[] {
	// Boundary: the text is what `encodeCell` wrote on the other thread.
	return JSON.parse(text) as Op[];
}

/** What a thread caught, ready to cross: an error's name, message and stack. */
export function encodeError(error: unknown): ThrownError {
	if (!(error instanceof Error)) return { name: "Error", message: String(error) };
	const thrown: ThrownError = { name: error.name, message: error.message };
	if (typeof error.stack === "string") thrown.stack = error.stack;
	return thrown;
}

/** The error the other thread caught, as an `Error` with its name, message and stack. */
export function decodeError(thrown: ThrownError): Error {
	const error = new Error(thrown.message);
	error.name = thrown.name;
	if (thrown.stack !== undefined) error.stack = thrown.stack;
	return error;
}
