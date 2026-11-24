// The globals the polyfill folder reads, on either thread. Add a member when a fill first uses it,
// after checking it on the engine.

/** A global object, or a prototype, its values by name. */
export type Scope = Record<PropertyKey, unknown>;

/** What a thread's Lynx says about the device (`SystemInfo`, `lynx.SystemInfo`). */
export interface ThreadSystemInfo {
	/** `"iOS"` or `"Android"`. */
	platform?: string;
	/** The Lynx engine's version, such as `"4.2"`. */
	engineVersion?: string;
}

/** What the fills use of a thread's `lynx`. */
export interface ThreadLynx {
	/** The engine's microtask queue: the background has it, the main thread does not. */
	queueMicrotask?(callback: () => void): void;
	/** Reports an error into Lynx: LogBox shows it. */
	reportError(error: unknown): void;
	/** The main thread's device facts; the background has them as the global `SystemInfo`. */
	SystemInfo?: ThreadSystemInfo;
	/** lynx-core's `fetch`, on the background only (lynx-core's lynx/lynx.ts). */
	fetch?(input: string, init: object): PromiseLike<unknown>;
}

/** The timers a thread's code calls by name. */
export interface ThreadTimers {
	setTimeout(callback: () => void, delay?: number): unknown;
	clearTimeout(id: unknown): void;
	setInterval(callback: () => void, delay?: number): unknown;
	clearInterval(id: unknown): void;
}

/** What the fills use of a thread's `console`. */
export interface ThreadConsole {
	log(...data: unknown[]): void;
	error(...data: unknown[]): void;
	warn(...data: unknown[]): void;
}

// On the background `lynx`, the timers and `console` are parameters of the function Lynx's runtime
// wrapper writes around the bundle; on the main thread they are globals. Either way, the bundle
// reads them by name.
declare const lynx: ThreadLynx;
declare const setTimeout: ThreadTimers["setTimeout"];
declare const clearTimeout: ThreadTimers["clearTimeout"];
declare const setInterval: ThreadTimers["setInterval"];
declare const clearInterval: ThreadTimers["clearInterval"];
declare const console: ThreadConsole;

/** The thread's `lynx`, read when it is used. */
export function readLynx(): ThreadLynx {
	return lynx;
}

/** The thread's timers, as its code reads them by name. */
export function readTimers(): ThreadTimers {
	return { setTimeout, clearTimeout, setInterval, clearInterval };
}

/** The thread's `console`, as its code reads it by name; `undefined` on a thread without one. */
export function readConsole(): ThreadConsole | undefined {
	return typeof console === "undefined" ? undefined : console;
}

// Boundary: the fills put globals on it by name.
/** The thread's global object, where the fills go. */
export const globalScope: Scope = globalThis as unknown as Scope;
