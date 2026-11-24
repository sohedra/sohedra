// Main-thread functions' calls of background functions (`runOnBackground`), on one page. A call
// names its function by the handle's id within the context of the copy that holds it, and settles
// with the background's reply. The first frame's calls, and every call until its log is replayed,
// wait in the first frame's log, in order with the events it heard; hydration names their
// functions. A call the page cannot make rejects at once: from a page that is gone, for a value
// that is no handle, or for a first-frame function no background function took over. The binding
// reports what it refuses, once for the first frame's calls with how many; the promise a call
// returns is marked handled, so a call nobody awaits reports nothing more.

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
interface BackgroundCalls {
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
	/**
	 * The page reloads, ends or did not start: every call waiting rejects, and so does every call
	 * after, with `reason` when one is given.
	 */
	silence(reason?: Error): void;
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

/** What a value given to `runOnBackground` is called in a message. */
function nameOf(value: unknown): string {
	if (typeof value === "function") return value.name === "" ? "an unnamed function" : value.name;
	return value === null ? "null" : `a value of type ${typeof value}`;
}

/** The calls of one page, sent with `send`, for the contexts `lifetimes` holds. */
export function createBackgroundCalls(options: {
	send(message: ToBackground): void;
	report(error: unknown): void;
	lifetimes: Lifetimes;
	/** Runs `callback` at the end of the task. */
	soon(callback: () => void): void;
}): BackgroundCalls {
	const { send, report, lifetimes, soon } = options;
	const waiting = new Map<
		number,
		{ resolve(value: unknown): void; reject(error: unknown): void }
	>();
	let nextCall = 1;
	let firstFrame: unknown[] | null = null;
	let hydrated = false;
	let silenced = false;
	/** Why a call of a silenced page rejects. */
	let ended: () => Error = gone;
	/** The first frame's calls with no answer: reported once, with how many came in that task. */
	let unansweredCount = 0;
	let unansweredReported = false;

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

	/**
	 * The error of a call held for a first-frame function no background function took over. The
	 * first of a page's is reported at the end of its task, with how many came in it; the rest only
	 * reject. With `quiet`, nothing is reported: the hydration's own report says why.
	 */
	function unanswered(quiet = false): Error {
		const error = mainThreadError({ code: "first_frame_call_unanswered", details: { count: 1 } });
		if (quiet || unansweredReported) return error;
		if (unansweredCount++ === 0)
			soon(() => {
				unansweredReported = true;
				report(
					mainThreadError({
						code: "first_frame_call_unanswered",
						details: { count: unansweredCount },
					}),
				);
			});
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
			if (!isBackgroundHandle(handle)) {
				const error = mainThreadError({
					code: "not_a_background_function_handle",
					details: { name: nameOf(handle) },
				});
				report(error);
				return handled(Promise.reject(error));
			}
			const id = handle[HANDLE_FIELDS.id];
			if (silenced) return handled(Promise.reject(ended()));
			if (id === undefined) return handled(Promise.reject(hydrated ? unanswered() : gone()));
			const context = handle[HANDLE_FIELDS.context];
			if (context === undefined || !lifetimes.has(context)) return handled(Promise.reject(gone()));
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
			// Hydration could not adopt the frame, and says why: the calls reject with no report.
			const error = unanswered(true);
			for (const held of log.filter(isHeldCall)) held.call.reject(error);
		},
		sendHeld({ call: held }) {
			const id = held.handle[HANDLE_FIELDS.id];
			const context = held.handle[HANDLE_FIELDS.context];
			if (silenced) held.reject(ended());
			else if (context !== undefined && !lifetimes.has(context)) held.reject(gone());
			else if (id === undefined || context === undefined) held.reject(unanswered());
			else call(id, context, held.params).then(held.resolve, held.reject);
		},
		silence(reason) {
			silenced = true;
			if (reason) ended = () => reason;
			const left = [...waiting.values()];
			waiting.clear();
			for (const entry of left) entry.reject(ended());
			const log = firstFrame;
			firstFrame = null;
			for (const entry of log ?? []) if (isHeldCall(entry)) entry.call.reject(ended());
		},
	};
}
