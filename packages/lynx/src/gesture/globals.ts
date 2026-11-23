// The build's per-thread constants and the engine's `lynx`, as this folder reads them. The plugin
// replaces each constant with the thread's value in each thread's bundle; in this folder they are
// declared here and named nowhere else.

declare const __MAIN_THREAD__: boolean | undefined;
declare const __DEV__: boolean | undefined;

// On the background `lynx` is a parameter of the function the bundle's wrapper hands lynx-core, and
// on the main thread a global: either way it is read by its name. Unset in Node.
declare const lynx:
	| { reportError(error: unknown, options?: { level?: "error" | "warning" }): void }
	| undefined;

/**
 * `true` where the first frame is drawn: the main thread's bundle. Unset (Node, a plain test), the
 * code counts as the background's.
 */
export const MAIN_THREAD: boolean = typeof __MAIN_THREAD__ !== "undefined" && __MAIN_THREAD__;

/** `true` in a development build. Unset (Node, a plain test), it is not one. */
export const DEV: boolean = typeof __DEV__ !== "undefined" && __DEV__;

/** Reports `warning` into Lynx at its warning level. Never throws. */
export function reportWarning(warning: Error): void {
	try {
		if (typeof lynx !== "undefined") lynx.reportError(warning, { level: "warning" });
	} catch {
		// Reporting must never throw.
	}
}
