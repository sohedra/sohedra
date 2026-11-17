// The globals of the page's own main-thread script, as this folder's code may use them. Add a
// member when code first uses it, after checking it on the engine.

/** What the main thread's engine provides to the first frame. */
export interface FirstFrameGlobals {
	lynx: { reportError(error: unknown): void };
}

// Boundary: the engine's globals have no types; this is the one place `globalThis` is typed.
export const firstFrame: FirstFrameGlobals = globalThis as unknown as FirstFrameGlobals;
