// The background thread's fills, which the binding's start-up runs before any other module of the
// page loads. The list is the thread's: a fill that is not here never reaches the background's
// script. Eager fills first (what other fills and an app's first line need), then the lazy ones.

import { globalScope, readLynx } from "./globals.ts";
import type { Scope, ThreadLynx } from "./globals.ts";
import { fillArrayMethods } from "./language/array-methods.ts";
import { fillBigIntAsUintN } from "./language/bigint-as-uint-n.ts";
import { fillErrorCause } from "./language/error-cause.ts";
import { fillLynxPromise } from "./language/lynx-promise.ts";
import { fillObjectMethods } from "./language/object-methods.ts";
import { fillPromiseStatics } from "./language/promise-statics.ts";
import { fillRegExpEscape } from "./language/regexp-escape.ts";
import { fillStringMethods } from "./language/string-methods.ts";
import { fillWrongBuiltIns } from "./language/wrong-built-ins.ts";
import { fillAtob } from "./web/atob.ts";
import { fillEventTarget } from "./web/event-target.ts";
import { backgroundQueue, fillQueueMicrotask } from "./web/queue-microtask.ts";
import { fillStructuredClone } from "./web/structured-clone.ts";

export { setErrorHook } from "./errors.ts";
export type { ErrorHook } from "./errors.ts";

/**
 * Where the background's web fills go: the thread's own unless a test gives its own. The language fills
 * go on the thread's own built-ins, where core-js's modules put them.
 */
export interface BackgroundTargets {
	/** The thread's global object. */
	scope: Scope;
	/** The thread's `lynx`, read when a fill uses it. */
	readLynx: () => ThreadLynx;
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
	fillBigIntAsUintN();
	fillEventTarget(scope);
	fillStructuredClone(scope);
	fillAtob(scope);
}
