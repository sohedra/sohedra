// The globals of Lynx's background thread, as this folder's code may use them. Add a member when
// code first uses it, after checking it on the engine.

/** What the background thread's engine provides. */
export interface BackgroundGlobals {
	lynx: {
		reportError(error: unknown): void;
		queueMicrotask(callback: () => void): void;
		setTimeout(callback: () => void, delay?: number): number;
	};
}

// Boundary: the engine's globals have no types; this is the one place `globalThis` is typed.
export const background: BackgroundGlobals = globalThis as unknown as BackgroundGlobals;
