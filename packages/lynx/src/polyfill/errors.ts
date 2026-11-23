// Where the fills send what they catch: what a microtask throws, `reportError`, and the error events
// of the global object. The binding sets the hook as its thread starts, so these reach the page's
// `onError`; until then, and without a binding, they are reported into Lynx.

import { readLynx } from "./globals.ts";

/** Takes an error a fill caught. Never throws. */
export type ErrorHook = (error: unknown) => void;

let hook: ErrorHook | undefined;

/** Sends what the fills catch to `next` (`undefined`: into Lynx, as before a hook is set). */
export function setErrorHook(next: ErrorHook | undefined): void {
	hook = next;
}

/** Reports an error a fill caught. Never throws. */
export function reportCaught(error: unknown): void {
	try {
		if (hook) hook(error);
		else readLynx().reportError(error);
	} catch {
		// Reporting must never throw over the error.
	}
}
