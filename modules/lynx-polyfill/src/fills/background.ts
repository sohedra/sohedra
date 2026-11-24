// The background thread's baseline: what `import "@sohedra/lynx-polyfill"` installs there. Eager
// fills first (what other fills and an app's first line need), then the lazy ones. The extra fills
// (EventSource, compression, URLPattern, messaging) and the heavy language fills (iterator helpers,
// Set methods, Float16Array, normalize) are not in it: each has its own import.

import { globalScope, readConsole, readLynx, readTimers } from "./globals.ts";
import type { Scope, ThreadConsole, ThreadLynx, ThreadTimers } from "./globals.ts";
import { fillArrayMethods } from "./language/array-methods.ts";
import { fillBigIntAsUintN } from "./language/bigint-as-uint-n.ts";
import { fillErrorCause } from "./language/error-cause.ts";
import { fillLynxPromise } from "./language/lynx-promise.ts";
import { fillObjectMethods } from "./language/object-methods.ts";
import { fillPromiseStatics } from "./language/promise-statics.ts";
import { fillReflectToStringTag } from "./language/reflect-to-string-tag.ts";
import { fillRegExpEscape } from "./language/regexp-escape.ts";
import { fillStringMethods } from "./language/string-methods.ts";
import { fillWrongBuiltIns } from "./language/wrong-built-ins.ts";
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

/**
 * Where the background's web fills go: the thread's own unless a test gives its own. The language fills
 * go on the thread's own built-ins, where core-js's modules put them.
 */
export interface BackgroundTargets {
	/** The thread's global object. */
	scope: Scope;
	/** The thread's `lynx`, read when a fill uses it. */
	readLynx: () => ThreadLynx;
	/** The timers the bundle reads by name: the thread's own by default. */
	timers?: ThreadTimers;
	/** The `console` the bundle reads by name: the thread's own by default. */
	console?: ThreadConsole;
}

/** Fills in what the background's engine lacks or gets wrong, leaving what works. */
export function fillBackground(
	targets: BackgroundTargets = { scope: globalScope, readLynx },
): void {
	const { scope } = targets;
	fillQueueMicrotask(scope, backgroundQueue(targets.readLynx));
	fillWrongBuiltIns();
	fillErrorCause();
	fillArrayMethods();
	fillObjectMethods();
	fillStringMethods();
	fillPromiseStatics();
	fillLynxPromise(targets.readLynx);
	fillRegExpEscape();
	fillReflectToStringTag();
	fillBigIntAsUintN();
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
