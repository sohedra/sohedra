// `queueMicrotask`: HTML § 8.7 "Microtask queuing". Neither thread has it as a global. What a
// callback throws is reported (errors.ts), as HTML reports an exception, and never stops the
// queue. A framework may put its own first (Sohedra's binding does, for its pages' queues): this one
// then steps aside.

import { reportCaught } from "../errors.ts";
import type { Scope, ThreadLynx } from "../globals.ts";
import { installEager } from "../install.ts";

/** Queues a callback as the thread's microtask. */
type Enqueue = (run: () => void) => void;

/** @workaround web-queue-microtask kind=lynx-gap delete-when="both of Lynx's threads have a global queueMicrotask" */
export function fillQueueMicrotask(scope: Scope, enqueue: Enqueue): void {
	installEager(scope, "queueMicrotask", createQueueMicrotask(enqueue), isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** `queueMicrotask` over the thread's own queue. */
function createQueueMicrotask(enqueue: Enqueue): (callback: () => void) => void {
	return function queueMicrotask(callback: () => void): void {
		if (typeof callback !== "function")
			throw new TypeError("queueMicrotask takes a function, and was given something else.");
		enqueue(() => {
			try {
				callback();
			} catch (error) {
				reportCaught(error);
			}
		});
	};
}

/**
 * The background's queue: lynx-core's `lynx.queueMicrotask`, the engine's microtask queue itself,
 * read when a callback is queued.
 */
export function backgroundQueue(readLynx: () => ThreadLynx): Enqueue {
	return (run) => {
		const lynx = readLynx();
		// Boundary: lynx-core's background `lynx` has it; the main thread's has not.
		(lynx.queueMicrotask as (callback: () => void) => void)(run);
	};
}

/**
 * The main thread's queue: a promise's reaction. The engine runs pending jobs after each call into
 * the script (core/runtime/lepusng/quick_context.cc, EvalLepusPendingTask).
 */
export const mainThreadQueue: Enqueue = (run) => {
	void Promise.resolve().then(run);
};
