// The globals of Lynx's main thread, as this folder's code may use them. Add a member when code
// first uses it, after checking it on the engine.

/** What the main thread's engine provides: Lynx's element functions, and a smaller `lynx`. */
export interface MainThreadGlobals {
	lynx: { reportError(error: unknown): void };
	__FlushElementTree(): void;
	__GetPageElement(): unknown;
}

// Boundary: the engine's globals have no types; this is the one place `globalThis` is typed.
export const mainThread: MainThreadGlobals = globalThis as unknown as MainThreadGlobals;
