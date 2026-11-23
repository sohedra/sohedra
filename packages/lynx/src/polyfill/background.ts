// The background thread's fills, which the binding's start-up runs before any other module of the
// page loads. The list is the thread's: a fill that is not here never reaches the background's
// script. Eager fills first (what other fills and an app's first line need), then the lazy ones.

import { globalScope, readLynx } from "./globals.ts";
import type { Scope, ThreadLynx } from "./globals.ts";
import { fillReplaceAll } from "./language/replace-all.ts";
import { fillAtob } from "./web/atob.ts";
import { fillEventTarget } from "./web/event-target.ts";
import { backgroundQueue, fillQueueMicrotask } from "./web/queue-microtask.ts";
import { fillStructuredClone } from "./web/structured-clone.ts";

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
}

/** Fills in what the background's engine lacks or gets wrong, leaving what works. */
export function fillBackground(
	targets: BackgroundTargets = { scope: globalScope, strings: String.prototype, readLynx },
): void {
	const { scope, strings } = targets;
	fillQueueMicrotask(scope, backgroundQueue(targets.readLynx));
	fillReplaceAll(strings);
	fillEventTarget(scope);
	fillStructuredClone(scope);
	fillAtob(scope);
}
