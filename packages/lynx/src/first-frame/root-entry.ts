// `@sohedra/lynx` on the main thread, where the page's main-thread code imports it: the page's
// entry, which records the first frame with `mountPage`, its components, as they draw the first
// frame, and the bodies of its main-thread functions. The calls go to the main thread's runtime
// through the global it shares with the page's code. Its background side is
// ../background/root-entry.ts.

import { FUNCTION_FIELDS, isMainThreadFunction, REF_FIELDS } from "../wire/index.ts";
import type { FunctionsRuntime, MainThreadRefHandle } from "../wire/index.ts";
import { firstFrameDevelopmentError, firstFrameError } from "./catalogue.ts";
import { drawing } from "./drawing.ts";
import { DEV, firstFrame, functionsGlobal } from "./globals.ts";

export { mountPage } from "./page.ts";
export type { MountPageOptions } from "./page.ts";
export { createStaticCopy, mount, reportError, root, unmount } from "./stand-ins.ts";

declare const brand: unique symbol;

/** A value the main thread owns, which main-thread functions share: see the background's. */
export interface MainThreadRef<T> {
	current: T;
	readonly [brand]: T;
}

/** The runtime, or the call's rejection when it has not started. */
function runtimeFor(call: string): FunctionsRuntime | Error {
	return (
		functionsGlobal().runtime ??
		firstFrameError({ code: "main_thread_runtime_missing", details: { call } })
	);
}

/** The functions whose call as the first frame was drawn was warned about, by id. */
const warned = new Set<string>();

/**
 * Calls the main-thread function `fn` now, from a main-thread function: resolves with its result.
 * Called as the first frame is drawn, by a component's top-level code, it does nothing, and never
 * settles: the background's same call runs it once the page starts, as `$effect` runs then.
 */
export function runOnMainThread<Args extends unknown[], Result>(
	fn: (...args: Args) => Result,
): (...args: Args) => Promise<Awaited<Result>> {
	return (...params) => {
		if (drawing()) {
			const id = isMainThreadFunction(fn) ? fn[FUNCTION_FIELDS.id] : String(fn);
			if (DEV && !warned.has(id)) {
				warned.add(id);
				firstFrame.lynx.reportError(
					firstFrameDevelopmentError({
						code: "run_on_main_thread_in_first_frame",
						details: { id },
					}),
					{ level: "warning" },
				);
			}
			return new Promise(() => {});
		}
		const runtime = runtimeFor("runOnMainThread");
		if (runtime instanceof Error) return Promise.reject(runtime);
		// Boundary: the runtime answers with what the function returned.
		return runtime.runOnMainThread(fn, params) as Promise<Awaited<Result>>;
	};
}

/**
 * Calls the background function `fn` from a main-thread function: resolves with what it returns,
 * awaited when it is a thenable, and rejects with what it threw.
 */
export function runOnBackground<Args extends unknown[], Result>(
	fn: (...args: Args) => Result,
): (...args: Args) => Promise<Awaited<Result>> {
	return (...params) => {
		const runtime = runtimeFor("runOnBackground");
		if (runtime instanceof Error) return Promise.reject(runtime);
		// Boundary: the background answers with what the function returned.
		return runtime.runOnBackground(fn, params) as Promise<Awaited<Result>>;
	};
}

/** A main-thread ref the first frame makes, with an id of the first frame's own. */
class FirstFrameRef<T> {
	declare readonly [REF_FIELDS.id]: number;
	declare readonly [REF_FIELDS.initial]: T;

	constructor(initial: T) {
		// Boundary: the fields are the handle's, set once here.
		(this as { [REF_FIELDS.id]: number })[REF_FIELDS.id] = functionsGlobal().nextFirstFrameRef--;
		(this as { [REF_FIELDS.initial]: T })[REF_FIELDS.initial] = initial;
	}

	get current(): T {
		return this[REF_FIELDS.initial];
	}

	set current(_value: T) {
		throw firstFrameError({ code: "main_thread_ref_set_outside_function", details: {} });
	}

	/** The handle as the first frame's markup writes it. */
	toJSON(): MainThreadRefHandle {
		return { [REF_FIELDS.id]: this[REF_FIELDS.id], [REF_FIELDS.initial]: this[REF_FIELDS.initial] };
	}
}

/** Makes a main-thread ref that starts as `initial`: see the background's. */
export function mainThreadRef<T>(initial: T): MainThreadRef<T>;
/** Makes a main-thread ref that starts as `undefined`. */
export function mainThreadRef<T = undefined>(): MainThreadRef<T | undefined>;
export function mainThreadRef<T>(initial?: T): MainThreadRef<T | undefined> {
	// Boundary: the handle is the ref; its type hides how it crosses.
	return new FirstFrameRef(initial) as unknown as MainThreadRef<T | undefined>;
}
