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
