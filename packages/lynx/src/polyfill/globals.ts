// The globals the polyfill folder reads, on either thread. Add a member when a fill first uses it,
// after checking it on the engine.

/** A global object, or a prototype, its values by name. */
export type Scope = Record<PropertyKey, unknown>;

/** What the fills use of a thread's `lynx`. */
export interface ThreadLynx {
	/** The engine's microtask queue: the background has it, the main thread does not. */
	queueMicrotask?(callback: () => void): void;
	/** Reports an error into Lynx: LogBox shows it. */
	reportError(error: unknown): void;
}

// On the background `lynx` is a parameter of the function Lynx's runtime wrapper writes around the
// bundle; on the main thread it is a global. Either way, the bundle reads it by name.
declare const lynx: ThreadLynx;

/** The thread's `lynx`, read when it is used. */
export function readLynx(): ThreadLynx {
	return lynx;
}

// Boundary: the fills put globals on it by name.
/** The thread's global object, where the fills go. */
export const globalScope: Scope = globalThis as unknown as Scope;
