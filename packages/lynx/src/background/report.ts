// How the background reports into Lynx: errors with `lynx.reportError`, then to the page's
// `onError`; warnings, in development builds only, at Lynx's warning level, once per place. In a
// development build an error that repeats is reported the first time and at each power of ten, with
// its count. lynx-core gives every report from this thread Lynx's code for a background error: only
// the level is the binding's.

import { createRepeats, withCount } from "../wire/index.ts";
import { asError, heard } from "./errors.ts";
import type { ErrorSource } from "./errors.ts";
import { background, DEV } from "./globals.ts";

const repeats = createRepeats();

/** The page starts again: repeats are counted from none. */
export function clearRepeats(): void {
	repeats.clear();
}

/**
 * Reports an error the background caught into Lynx, then to the page's `onError`, with what is
 * known of where it came from. Never throws over the error it reports.
 */
export function report(error: unknown, source?: ErrorSource): void {
	const thrown = asError(error);
	const count = DEV ? repeats.count(thrown) : 1;
	if (count === undefined) return;
	try {
		// The first report is the value as it was given; a repeat's names its count.
		background.lynx.reportError(count === 1 ? error : withCount(thrown, count));
	} catch {
		// Reporting must never throw over the error.
	}
	heard(thrown, "background", source);
}

/**
 * Reports an error into Lynx, as the binding reports its own: LogBox shows it, and the page's
 * `onError` hears it. A value that is not an `Error` is wrapped in one. Never throws over the error
 * it reports.
 *
 * In a main-thread function, import it with `with { runtime: "shared" }`
 * (`import { reportError } from "@sohedra/lynx" with { runtime: "shared" }`): it then reports from
 * the main thread. A plain import is captured as the background's function, which cannot cross
 * to the main thread.
 */
export function reportError(error: unknown): void {
	report(error);
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
