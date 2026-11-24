// Where the fills send what they catch: what a microtask or an event listener throws, `reportError`.
// As HTML reports an exception, each is first an `error` event on the global object (the global
// events fill sets that up), and a listener's `preventDefault()` keeps it from going further; else
// it is reported into Lynx with `lynx.reportError`, which LogBox shows.
//
// A framework hears these errors as the web does: it listens for `error` on the global object and
// calls `preventDefault()` on the events it reports itself (Sohedra's binding does). The fills never
// import a framework, and no framework imports them.

import { readLynx } from "./globals.ts";

/** Fires an `error` event for `error`, and answers whether its default (the report) should run. */
export type ErrorDispatch = (error: unknown) => boolean;

let dispatch: ErrorDispatch | undefined;
/** Whether an `error` event is being dispatched: what its listeners throw is reported, not fired. */
let dispatching = false;

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
		readLynx().reportError(error);
	} catch {
		// Reporting must never throw over the error.
	}
}
