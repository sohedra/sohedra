// How the background reports into Lynx: errors with `lynx.reportError`, and warnings, in
// development builds only, at Lynx's warning level, once per place.

import { background, DEV } from "./globals.ts";

/** Reports an error into Lynx. Never throws over the error it reports. */
export function reportError(error: unknown): void {
	try {
		background.lynx.reportError(error);
	} catch {
		// Reporting must never throw over the error.
	}
}

const warned = new Set<string>();

/**
 * Reports `warning` into Lynx at its warning level, in a development build, the first time
 * `place` warns. `place` names the warning and where it is, so each place warns once.
 */
export function warnOnce(place: string, warning: () => Error): void {
	if (!DEV || warned.has(place)) return;
	warned.add(place);
	try {
		background.lynx.reportError(warning(), { level: "warning" });
	} catch {
		// Reporting must never throw.
	}
}

/**
 * Reports `error` into Lynx, in a development build, the first time `place` reports it: a mistake
 * in the page's code that the binding finds, which repeats wherever the code runs again.
 */
export function reportOnce(place: string, error: () => Error): void {
	if (!DEV || warned.has(place)) return;
	warned.add(place);
	reportError(error());
}
