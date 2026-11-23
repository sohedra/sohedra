// The main thread's `queueMicrotask`: the build points the free name `queueMicrotask` (and
// `globalThis.queueMicrotask`) in every module of the main thread's script here
// (build/plugin/resolve.ts), as it points the background's at that page's own; and the engine gap
// fill puts it on the global object where the engine has none.

/**
 * Queues `callback` as a promise's reaction, the main thread's microtask: the engine runs pending
 * jobs after each call into the script and reports a rejection left unhandled with the main
 * thread's code (core/runtime/lepusng/quick_context.cc, QuickContext::InternalCall and
 * EvalLepusPendingTask).
 */
export function queueMicrotask(callback: () => void): void {
	void Promise.resolve().then(callback);
}

/**
 * Puts this `queueMicrotask` on the global object where the engine has none, before the polyfill
 * folder's fills: code the build does not see queues as the page's own does, and a throw reaches
 * Lynx as the main thread's, unhandled. The polyfill's own global is for apps without the binding.
 *
 * @workaround main-thread-queue-microtask kind=lynx-gap delete-when="Lynx's main thread has a global queueMicrotask"
 */
export function fillQueueMicrotask(scope: Record<string, unknown>): void {
	if (typeof scope["queueMicrotask"] === "function") return;
	Object.defineProperty(scope, "queueMicrotask", {
		value: queueMicrotask,
		writable: true,
		enumerable: false,
		configurable: true,
	});
}
