// Calls between the background and main-thread functions, on the background: running a
// main-thread function from here (`runOnMainThread`), and the handle a main-thread function holds
// for each background function it calls (`runOnBackground`). A call rides in the patch, after the
// ops made before it, and its promise settles with the main thread's answer: the value, awaited
// when it is a thenable, or what the function threw.
//
// The promise a call returns is marked handled: a call nobody awaits does not report a rejection a
// second time. What the function threw is reported on the thread it ran on, and what the binding
// refused, here.

import { HANDLE_FIELDS, isMainThreadFunction } from "../../wire/index.ts";
import type { BackgroundFunctionHandle, CallRequest } from "../../wire/index.ts";
import { backgroundError } from "../catalogue.ts";
import { reportError } from "../report.ts";

/** Where calls reach the main thread: the running page's channel. */
interface CallHost {
	call(request: CallRequest): Promise<unknown>;
	/** The ids of the main-thread function contexts the page keeps. */
	contexts(): number[];
}

let host: CallHost | null = null;

/** The running page takes the calls made from now on, or none does. */
export function callThrough(next: CallHost | null): void {
	host = next;
}

/** The ids of the main-thread function contexts the running page keeps, for tests. */
export function keptContexts(): number[] {
	return host?.contexts() ?? [];
}

/** The error of a call made when no page runs. */
const pageGone = (): Error =>
	backgroundError({ code: "page_is_gone", details: { call: "runOnMainThread" } });

/** `promise`, marked handled: an awaited call still rejects. */
function handled<T>(promise: Promise<T>): Promise<T> {
	promise.catch(() => {});
	return promise;
}

/** What a value a call was given is called in a message: a function's name, or what it is. */
function nameOf(value: unknown): string {
	if (typeof value === "function") return value.name === "" ? "an unnamed function" : value.name;
	return value === null ? "null" : `a value of type ${typeof value}`;
}

/**
 * Calls the main-thread function `fn` with `params` from the background, after the elements made
 * and changed before the call: a state change the call must see needs `await tick()` first, as
 * for an element's methods. Resolves with what the function returns, awaited when it is a
 * thenable. Rejects with what it threw, when `fn` is not a main-thread function (reported), and
 * when the page reloads or closes first. `params` and the result are copied as plain data. Called
 * as the page's first frame is drawn, on the main thread, it does nothing: the background's same
 * call runs it once the page starts.
 */
export function runOnMainThread<Args extends unknown[], Result>(
	fn: (...args: Args) => Result,
): (...args: Args) => Promise<Awaited<Result>> {
	return (...params) => {
		if (!isMainThreadFunction(fn)) {
			const error = backgroundError({
				code: "not_a_main_thread_function",
				details: { name: nameOf(fn) },
			});
			reportError(error);
			return handled(Promise.reject(error));
		}
		if (!host) return handled(Promise.reject(pageGone()));
		// Boundary: the main thread answers with what the function returned.
		return handled(host.call(["run", fn, params]) as Promise<Awaited<Result>>);
	};
}

/**
 * Calls the background function `fn` from a main-thread function. It works only inside one: there
 * the build gives `fn`'s handle, and the call resolves with what `fn` returns. Called on the
 * background, it throws.
 */
export function runOnBackground<Args extends unknown[], Result>(
	fn: (...args: Args) => Result,
): (...args: Args) => Promise<Awaited<Result>> {
	throw backgroundError({
		code: "run_on_background_outside_main_thread",
		details: { name: nameOf(fn) },
	});
}

/** A handle as the background holds it: the function stays here, and only its id crosses. */
interface HeldHandle extends BackgroundFunctionHandle {
	_fn?: (...args: unknown[]) => unknown;
}

let nextHandle = 1;

/**
 * The handle a main-thread function holds for the background function `fn` it calls: compiled code
 * calls this where it writes `runOnBackground(fn)`. The function is left out of what crosses, as
 * JSON leaves out every function.
 */
export function transformToWorklet(fn: unknown): HeldHandle {
	const handle: HeldHandle = { [HANDLE_FIELDS.id]: nextHandle++ };
	// Boundary: a function, or what the main thread is told is none.
	if (typeof fn === "function") handle._fn = fn as (...args: unknown[]) => unknown;
	return handle;
}
