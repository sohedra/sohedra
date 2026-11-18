// Main-thread functions' calls of background functions (`runOnBackground`), on one page. A call
// names its function by the handle's id within the context of the copy that holds it, and settles
// with the background's reply. The first frame's calls, and every call until its log is replayed,
// wait in the first frame's log, in order with the events it heard; hydration names their
// functions. A call the page cannot make rejects at once: from a page that is gone, or for a
// first-frame function no background function took over, which is reported. The promise a call
// returns is marked handled: a call nobody awaits reports nothing more.

import { decodeError, HANDLE_FIELDS, isBackgroundHandle } from "../../wire/index.ts";
import type { BackgroundFunctionHandle, Result, ToBackground } from "../../wire/index.ts";
import { mainThreadError } from "../catalogue.ts";
import type { Lifetimes } from "./lifetimes.ts";

/** A `runOnBackground` call held in the first frame's log until hydration names its function. */
export interface HeldCall {
	call: {
		handle: BackgroundFunctionHandle;
		params: unknown[];
		resolve(value: unknown): void;
		reject(error: unknown): void;
	};
}

/** The calls of background functions of one page. */
export interface BackgroundCalls {
	/** `runOnBackground(handle)(...params)` from a main-thread function. */
	runOnBackground(handle: unknown, params: unknown[]): Promise<unknown>;
	/** The background answered a call. */
	reply(id: number, result: Result): void;
	/** The first frame's log, where calls wait until it is replayed. */
	holdFirstFrame(log: unknown[]): void;
	/** The log is replayed, or hydration could not adopt it: its calls not sent reject. */
	endFirstFrame(adopted: boolean): void;
	/** Sends a call the log held, now that hydration named its function, or could not. */
	sendHeld(held: HeldCall): void;
	/** The page reloads or ends: every call waiting rejects, and so does every call after. */
	silence(): void;
}

/** `promise`, marked handled: a call nobody awaits does not report its rejection a second time. */
export function handled<T>(promise: Promise<T>): Promise<T> {
	promise.catch(() => {});
	return promise;
}

const isHeldCall = (entry: unknown): entry is HeldCall =>
	typeof entry === "object" && entry !== null && "call" in entry;

const gone = (): Error =>
	mainThreadError({ code: "page_is_gone", details: { call: "runOnBackground" } });

/** The calls of one page, sent with `send`, for the contexts `lifetimes` holds. */
export function createBackgroundCalls(options: {
	send(message: ToBackground): void;
	report(error: unknown): void;
	lifetimes: Lifetimes;
}): BackgroundCalls {
	const { send, report, lifetimes } = options;
	const waiting = new Map<
		number,
		{ resolve(value: unknown): void; reject(error: unknown): void }
	>();
	let nextCall = 1;
	let firstFrame: unknown[] | null = null;
	let hydrated = false;
	let silenced = false;

	function call(fn: number, context: number, params: unknown[]): Promise<unknown> {
		const id = nextCall++;
		return new Promise((resolve, reject) => {
			waiting.set(id, { resolve, reject });
			try {
				send({ t: "call", id, fn, context, params });
			} catch (error) {
				waiting.delete(id);
				reject(error);
			}
		});
	}

	/** The error of a call held for a first-frame function no background function took over. */
	function unanswered(): Error {
		const error = mainThreadError({ code: "first_frame_call_unanswered", details: {} });
		report(error);
		return error;
	}

	return {
		runOnBackground(handle, params) {
			if (firstFrame && !silenced && isBackgroundHandle(handle)) {
				const log = firstFrame;
				return handled(
					new Promise((resolve, reject) => {
						const held: HeldCall = { call: { handle, params, resolve, reject } };
						log.push(held);
					}),
				);
			}
			const id = isBackgroundHandle(handle) ? handle[HANDLE_FIELDS.id] : undefined;
			if (id === undefined)
				return handled(Promise.reject(hydrated && !silenced ? unanswered() : gone()));
			// Boundary: a handle with an id is the background's, which the page held with its context.
			const context = (handle as BackgroundFunctionHandle)[HANDLE_FIELDS.context];
			if (silenced || context === undefined || !lifetimes.has(context))
				return handled(Promise.reject(gone()));
			return handled(call(id, context, params));
		},
		reply(id, result) {
			const entry = waiting.get(id);
			if (!entry) return;
			waiting.delete(id);
			if (result.ok) entry.resolve(result.value);
			else entry.reject(decodeError(result.error));
		},
		holdFirstFrame(log) {
			firstFrame = log;
		},
		endFirstFrame(adopted) {
			const log = firstFrame;
			firstFrame = null;
			hydrated = adopted;
			if (adopted || !log) return;
			const calls = log.filter(isHeldCall);
			if (calls.length === 0) return;
			const error = unanswered();
			for (const held of calls) held.call.reject(error);
		},
		sendHeld({ call: held }) {
			const id = held.handle[HANDLE_FIELDS.id];
			const context = held.handle[HANDLE_FIELDS.context];
			if (silenced || (context !== undefined && !lifetimes.has(context))) held.reject(gone());
			else if (id === undefined || context === undefined) held.reject(unanswered());
			else call(id, context, held.params).then(held.resolve, held.reject);
		},
		silence() {
			silenced = true;
			const ended = [...waiting.values()];
			waiting.clear();
			for (const entry of ended) entry.reject(gone());
			const log = firstFrame;
			firstFrame = null;
			for (const entry of log ?? []) if (isHeldCall(entry)) entry.call.reject(gone());
		},
	};
}
