// What the background's engine lacks, filled in before the page's modules load (start-up.ts): the
// page's own `queueMicrotask` first, then the polyfill folder's fills, and what they catch reported
// as the page's errors.

import { fillBackground, setErrorHook } from "../polyfill/background.ts";
import type { BackgroundTargets } from "../polyfill/background.ts";
import { globalScope } from "./globals.ts";
import type { BackgroundGlobals } from "./globals.ts";
import { queueMicrotask, queueOn } from "./queue-microtask.ts";
import { report } from "./report.ts";

export type { BackgroundTargets };

/** Fills in what the background's engine lacks, leaving what works, on `targets` or the thread's own. */
export function fillEngineGaps(targets?: BackgroundTargets): void {
	fillQueueMicrotask(targets);
	fillBackground(targets);
	setErrorHook((error) => report(error));
}

/**
 * Puts the page's queue on the global object where the engine has none, before the polyfill
 * folder's: code the build does not see queues as the page's own does, and what Svelte throws there
 * marks the page crashed (runSvelte). The polyfill's own global is for apps without the binding.
 *
 * @workaround background-queue-microtask kind=lynx-gap delete-when="Lynx's background thread has a global queueMicrotask and gives the binding a hook for what its callbacks throw"
 */
function fillQueueMicrotask(targets: BackgroundTargets | undefined): void {
	const scope = targets?.scope ?? globalScope;
	if (typeof scope["queueMicrotask"] === "function") return;
	const queue = targets
		? (callback: () => void) =>
				// Boundary: a test's `lynx`, which has the microtask queue the page's queue uses.
				queueOn(targets.readLynx() as BackgroundGlobals["lynx"], callback)
		: queueMicrotask;
	Object.defineProperty(scope, "queueMicrotask", {
		value: queue,
		writable: true,
		enumerable: false,
		configurable: true,
	});
}
