// The background thread's fills, which the binding's start-up runs before any other module of the
// page loads. The list is the thread's: a fill that is not here never reaches the background's
// script. Eager fills first (what other fills and an app's first line need), then the lazy ones.
// The four extra fills (EventSource, compression, URLPattern, messaging) are not listed: the
// build adds each to a script that names it.

import { globalScope, readConsole, readLynx, readTimers } from "./globals.ts";
import type { Scope, ThreadConsole, ThreadLynx, ThreadTimers } from "./globals.ts";
import { fillReplaceAll } from "./language/replace-all.ts";
import { fillAbort } from "./web/abort.ts";
import { fillAtob } from "./web/atob.ts";
import { fillBlob } from "./web/blob.ts";
import { fillConsole } from "./web/console.ts";
import { fillDOMException } from "./web/dom-exception.ts";
import { fillEncodingStreams } from "./web/encoding-streams.ts";
import { fillTextEncoding } from "./web/encoding.ts";
import { fillEvents } from "./web/events.ts";
import { fillFetch } from "./web/fetch.ts";
import { fillFormData } from "./web/form-data.ts";
import { fillGlobalEvents } from "./web/global-events.ts";
import { fillNavigator } from "./web/navigator.ts";
import { fillPerformance } from "./web/performance.ts";
import { backgroundQueue, fillQueueMicrotask } from "./web/queue-microtask.ts";
import { fillStreams } from "./web/streams.ts";
import { fillStructuredClone } from "./web/structured-clone.ts";
import { fillTimers } from "./web/timers.ts";
import { fillUrl } from "./web/url.ts";

export { setErrorHook } from "./errors.ts";
export type { ErrorHook } from "./errors.ts";

/** Where the background's fills go: the thread's own unless a test gives its own. */
export interface BackgroundTargets {
	/** The thread's global object. */
	scope: Scope;
	/** `String.prototype`. */
	strings: object;
	/** The thread's `lynx`, read when a fill uses it. */
	readLynx: () => ThreadLynx;
	/** The timers the bundle reads by name: the thread's own by default. */
	timers?: ThreadTimers;
	/** The `console` the bundle reads by name: the thread's own by default. */
	console?: ThreadConsole;
}

/** Fills in what the background's engine lacks or gets wrong, leaving what works. */
export function fillBackground(
	targets: BackgroundTargets = { scope: globalScope, strings: String.prototype, readLynx },
): void {
	const { scope, strings } = targets;
	fillQueueMicrotask(scope, backgroundQueue(targets.readLynx));
	fillReplaceAll(strings);
	fillTimers(scope, targets.timers ?? readTimers());
	const console = targets.console ?? readConsole();
	if (console) fillConsole(console);
	fillDOMException(scope);
	fillEvents(scope);
	fillGlobalEvents(scope);
	fillStreams(scope);
	fillFetch(scope, targets.readLynx);
	fillStructuredClone(scope);
	fillAtob(scope);
	fillNavigator(scope, targets.readLynx);
	fillTextEncoding(scope);
	fillEncodingStreams(scope);
	fillUrl(scope);
	fillPerformance(scope);
	fillAbort(scope);
	fillBlob(scope);
	fillFormData(scope);
}
