// The main thread's fills, which the binding's runtime runs as it starts, before the page's modules
// load. The list is the thread's: a fill that is not here never reaches the main thread's script,
// whose size the first frame waits on. Eager fills first, then the lazy ones.

import { globalScope } from "./globals.ts";
import type { Scope } from "./globals.ts";
import { fillReplaceAll } from "./language/replace-all.ts";
import { fillAtob } from "./web/atob.ts";
import { fillEventTarget } from "./web/event-target.ts";
import { fillQueueMicrotask, mainThreadQueue } from "./web/queue-microtask.ts";
import { fillStructuredClone } from "./web/structured-clone.ts";

export { setErrorHook } from "./errors.ts";
export type { ErrorHook } from "./errors.ts";

/** Where the main thread's fills go: the thread's own unless a test gives its own. */
export interface MainThreadTargets {
	/** The thread's global object. */
	scope: Scope;
	/** `String.prototype`. */
	strings: object;
}

/** Fills in what the main thread's engine lacks or gets wrong, leaving what works. */
export function fillMainThread(
	targets: MainThreadTargets = { scope: globalScope, strings: String.prototype },
): void {
	const { scope, strings } = targets;
	fillQueueMicrotask(scope, mainThreadQueue);
	fillReplaceAll(strings);
	fillEventTarget(scope);
	fillStructuredClone(scope);
	fillAtob(scope);
}
