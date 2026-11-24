// Where the fills send what they catch: what a microtask or an event listener throws, `reportError`.
// As HTML reports an exception, each is first an `error` event on the global object (the global
// events fill sets that up), and a listener's `preventDefault()` keeps it from going further; then
// it goes to the hook the binding sets as its thread starts, so it reaches the page's `onError`;
// until then, and without a binding, it is reported into Lynx.

import { readLynx } from "./globals.ts";

/** Takes an error a fill caught. Never throws. */
export type ErrorHook = (error: unknown) => void;

/** Fires an `error` event for `error`, and answers whether its default (the report) should run. */
export type ErrorDispatch = (error: unknown) => boolean;

let hook: ErrorHook | undefined;
let dispatch: ErrorDispatch | undefined;
/** Whether an `error` event is being dispatched: what its listeners throw is reported, not fired. */
let dispatching = false;

/** Sends what the fills catch to `next` (`undefined`: into Lynx, as before a hook is set). */
export function setErrorHook(next: ErrorHook | undefined): void {
	hook = next;
}

/** Fires each caught error as an event first, with `next` (`undefined`: no event). */
export function setErrorDispatch(next: ErrorDispatch | undefined): void {
	dispatch = next;
}

/** Reports an error a fill caught. Never throws. */
export function reportCaught(error: unknown): void {
	if (dispatch && !dispatching) {
		dispatching = true;
		let report = true;
		try {
			report = dispatch(error);
		} catch {
			// An event that could not be fired leaves the report to go ahead.
		} finally {
			dispatching = false;
		}
		if (!report) return;
	}
	try {
		if (hook) hook(error);
		else readLynx().reportError(error);
	} catch {
		// Reporting must never throw over the error.
	}
}
