// The main thread's fills, which the binding's runtime runs as it starts, before the page's modules
// load. The list is the thread's: a fill that is not here never reaches the main thread's script,
// whose size the first frame waits on. Eager fills first, then the lazy ones.

import { globalScope } from "./globals.ts";
import type { Scope } from "./globals.ts";
import { fillArrayMethods } from "./language/array-methods.ts";
import { fillBigIntAsUintN } from "./language/bigint-as-uint-n.ts";
import { fillErrorCause } from "./language/error-cause.ts";
import { fillObjectMethods } from "./language/object-methods.ts";
import { fillPromiseStatics } from "./language/promise-statics.ts";
import { fillReflectToStringTag } from "./language/reflect-to-string-tag.ts";
import { fillRegExpEscape } from "./language/regexp-escape.ts";
import { fillStringMethods } from "./language/string-methods.ts";
import { fillWrongBuiltIns } from "./language/wrong-built-ins.ts";
import { fillAtob } from "./web/atob.ts";
import { fillEventTarget } from "./web/event-target.ts";
import { fillQueueMicrotask, mainThreadQueue } from "./web/queue-microtask.ts";
import { fillStructuredClone } from "./web/structured-clone.ts";

export { setErrorHook } from "./errors.ts";
export type { ErrorHook } from "./errors.ts";

/**
 * Where the main thread's web fills go: the thread's own unless a test gives its own. The language fills
 * go on the thread's own built-ins, where core-js's modules put them.
 */
export interface MainThreadTargets {
	/** The thread's global object. */
	scope: Scope;
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
	fillEventTarget(scope);
	fillStructuredClone(scope);
	fillAtob(scope);
}
