// The globals of the page's own main-thread script, as this folder's code may use them. Add a
// member when code first uses it, after checking it on the engine.

/** What the main thread's engine provides to the first frame. */
export interface FirstFrameGlobals {
	lynx: {
		/** `level` is `"error"` (the default) or `"warning"`. */
		reportError(error: unknown, options?: { level?: "error" | "warning" }): void;
	};
}

// Boundary: the engine's globals have no types; this is the one place `globalThis` is typed.
export const firstFrame: FirstFrameGlobals = globalThis as unknown as FirstFrameGlobals;

/** Puts the function that draws the first frame where the main thread's runtime finds it. */
export function setGlobalFunction(name: string, fn: (...args: never[]) => unknown): void {
	// Boundary: the runtime finds it by name on the global object.
	(globalThis as unknown as Record<string, unknown>)[name] = fn;
}

declare const __DEV__: boolean;
declare const __FIRST_FRAME__: boolean | undefined;

/** `true` in a development build: the build replaces it, and drops what it guards otherwise. */
export const DEV: boolean = __DEV__;

/**
 * `false` in a build where no page draws its first frame, which then drops Svelte's server
 * renderer from the main thread. A test run leaves it unset, and draws.
 */
export const DRAWS: boolean = typeof __FIRST_FRAME__ === "undefined" || __FIRST_FRAME__;
