// The main thread's baseline: what `import "@sohedra/lynx-polyfill"` installs there. A fill that is
// not here never reaches the main thread's script, whose size the first frame waits on. Eager fills
// first, then the lazy ones. The extra fills (URLPattern, messaging) and the heavy language fills are
// not in it: each has its own import.

import { globalScope, readConsole, readLynx } from "./globals.ts";
import type { Scope, ThreadConsole, ThreadLynx } from "./globals.ts";
import { fillArrayMethods } from "./language/array-methods.ts";
import { fillBigIntAsUintN } from "./language/bigint-as-uint-n.ts";
import { fillErrorCause } from "./language/error-cause.ts";
import { fillObjectMethods } from "./language/object-methods.ts";
import { fillPromiseStatics } from "./language/promise-statics.ts";
import { fillReflectToStringTag } from "./language/reflect-to-string-tag.ts";
import { fillRegExpEscape } from "./language/regexp-escape.ts";
import { fillStringMethods } from "./language/string-methods.ts";
import { fillWrongBuiltIns } from "./language/wrong-built-ins.ts";
import { fillAbort } from "./web/abort.ts";
import { fillAtob } from "./web/atob.ts";
import { fillConsole } from "./web/console.ts";
import { fillDOMException } from "./web/dom-exception.ts";
import { fillTextEncoding } from "./web/encoding.ts";
import { fillEvents } from "./web/events.ts";
import { fillMainThreadFetch } from "./web/fetch.ts";
import { fillGlobalEvents } from "./web/global-events.ts";
import { fillNavigator } from "./web/navigator.ts";
import { fillPerformance } from "./web/performance.ts";
import { fillQueueMicrotask, mainThreadQueue } from "./web/queue-microtask.ts";
import { fillStructuredClone } from "./web/structured-clone.ts";
import { fillUrl } from "./web/url.ts";

/**
 * Where the main thread's web fills go: the thread's own unless a test gives its own. The language fills
 * go on the thread's own built-ins, where core-js's modules put them.
 */
export interface MainThreadTargets {
	/** The thread's global object. */
	scope: Scope;
	/** The thread's `lynx`, read when a fill uses it: the thread's own by default. */
	readLynx?: () => ThreadLynx;
	/** The thread's `console`: its own by default. */
	console?: ThreadConsole;
}

/** Fills in what the main thread's engine lacks or gets wrong, leaving what works. */
export function fillMainThread(targets: MainThreadTargets = { scope: globalScope }): void {
	const { scope } = targets;
	fillQueueMicrotask(scope, mainThreadQueue);
	fillWrongBuiltIns();
	fillErrorCause();
	fillArrayMethods();
	fillObjectMethods();
	fillStringMethods();
	fillPromiseStatics();
	fillRegExpEscape();
	fillReflectToStringTag();
	fillBigIntAsUintN();
	const console = targets.console ?? readConsole();
	if (console) fillConsole(console);
	fillDOMException(scope);
	fillEvents(scope);
	fillGlobalEvents(scope);
	fillStructuredClone(scope);
	fillAtob(scope);
	fillNavigator(scope, targets.readLynx ?? readLynx);
	fillTextEncoding(scope);
	fillUrl(scope);
	fillPerformance(scope);
	fillAbort(scope);
	fillMainThreadFetch(scope);
}
