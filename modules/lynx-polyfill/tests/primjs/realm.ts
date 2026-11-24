// What a thread of Lynx gives its scripts before the package's fills run, made in PrimJS's shell
// (scripts/primjs/host.cc), whose realm has only the engine's built-ins, `print` and `load`. As
// tests/build/device-threads.ts describes the threads:
//
// - `lynx`, with `reportError` (into LogBox) on both threads and the engine's `queueMicrotask` on
//   the background;
// - the timers, `setTimeout`, `clearTimeout`, `setInterval` and `clearInterval`, run by the
//   shell's task loop;
// - `console`, which both threads have.
//
// One difference: on a device the background's `lynx` and timers are parameters of the function
// Lynx's runtime wrapper writes around the page's script, not globals. A suite's scripts run as
// scripts of their own, which see only globals, so here they are globals on both threads.
//
// This file runs in PrimJS, bundled into the thread's script (thread-script.ts).

import type { Thread } from "../../src/fills/globals.ts";

declare function print(...values: unknown[]): void;

/** The line prefix of what a suite's realm tells the driver, one JSON value a line. */
export const REPORT_PREFIX = "##sohedra ";

// Taken as the realm is set up (setUpRealm), before a test can replace or delete the globals.
let write: (text: string) => void;
let quote: (value: unknown) => string;
let keysOf: (value: object) => string[];

/**
 * Tells the driver `message`, an object of primitives. Written field by field: PrimJS's
 * `JSON.stringify` of an object sets the elements of an array it makes inside, through any setter
 * a test put on `Array.prototype`.
 */
export function report(
	message: Record<string, string | number | boolean | null | undefined>,
): void {
	let text = "";
	for (const key of keysOf(message)) {
		const value = message[key];
		if (value !== undefined) text += `${text === "" ? "" : ","}${quote(key)}:${quote(value)}`;
	}
	write(`${REPORT_PREFIX}{${text}}`);
}

interface Timer {
	id: number;
	due: number;
	run: () => void;
	/** For an interval, its period. */
	every?: number;
}

const timers: Timer[] = [];
let nextTimerId = 1;

/** What runs when no timer is left: each returns whether it gave the realm more to do. */
const idleHooks: (() => boolean)[] = [];

/** Runs `hook` when the realm has nothing left to do, before the shell ends. */
export function whenIdle(hook: () => boolean): void {
	idleHooks.push(hook);
}

/**
 * Ends the realm's work: its timers are dropped, so the shell ends once its jobs have run, as a
 * runner closes a test's window when its harness has finished, intervals and all.
 */
export function endTimers(): void {
	timers.length = 0;
}

function addTimer(handler: unknown, delay: unknown, args: unknown[], repeat: boolean): number {
	if (typeof handler !== "function") throw new TypeError("The timer's handler is not a function.");
	const wait = Math.max(0, Number(delay) || 0);
	const timer: Timer = {
		id: nextTimerId++,
		due: Date.now() + wait,
		// Boundary: a timer's handler takes the arguments it was given.
		run: () => (handler as (...values: unknown[]) => void)(...args),
		...(repeat && { every: wait }),
	};
	timers.push(timer);
	return timer.id;
}

function clearTimer(id: unknown): void {
	const index = timers.findIndex((timer) => timer.id === id);
	if (index !== -1) timers.splice(index, 1);
}

/**
 * The shell's turn: runs the first timer due, earliest first and then in the order they were set,
 * and returns 0; or the milliseconds until one is due; or, with none left, runs the idle hooks and
 * returns -1 unless they gave it more to do.
 */
function hostTurn(): number {
	if (timers.length === 0) {
		let more = false;
		for (const hook of idleHooks) more = hook() || more;
		return more ? 0 : -1;
	}
	let next = timers[0]!;
	for (const timer of timers) if (timer.due < next.due) next = timer;
	const wait = next.due - Date.now();
	if (wait > 0) return wait;
	if (next.every === undefined) clearTimer(next.id);
	else next.due = Date.now() + next.every;
	try {
		next.run();
	} catch (error) {
		reportUncaught(error);
	}
	return 0;
}

/** What a thread does with an error nothing caught: Lynx shows it in LogBox, and the run logs it. */
function reportUncaught(error: unknown): void {
	report({ type: "reported", message: describe(error) });
}

/** An error's name, message and stack, as text. */
export function describe(error: unknown): string {
	if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim();
	return String(error);
}

/** Gives the realm what `thread` has before the package's fills run. */
export function setUpRealm(thread: Thread): void {
	write = print;
	quote = JSON.stringify;
	keysOf = Object.keys;
	// Boundary: the realm's global object, which the thread's globals go on.
	const scope = globalThis as unknown as Record<string, unknown>;
	scope["lynx"] = {
		reportError: reportUncaught,
		...(thread === "background" && {
			queueMicrotask: (callback: () => void) => {
				void Promise.resolve().then(callback);
			},
		}),
	};
	scope["setTimeout"] = (handler: unknown, delay?: unknown, ...args: unknown[]) =>
		addTimer(handler, delay, args, false);
	scope["setInterval"] = (handler: unknown, delay?: unknown, ...args: unknown[]) =>
		addTimer(handler, delay, args, true);
	scope["clearTimeout"] = clearTimer;
	scope["clearInterval"] = clearTimer;
	// Boundary: PrimJS's shell gives `console.log` only.
	const console = scope["console"] as Record<string, unknown>;
	for (const name of ["info", "warn", "error", "debug"]) console[name] ??= console["log"];
	// Not enumerable: the shell's, which no thread of Lynx has.
	Object.defineProperty(scope, "hostTurn", { value: hostTurn, configurable: true, writable: true });
}
