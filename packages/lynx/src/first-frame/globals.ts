// The globals of the page's own main-thread script, as this folder's code may use them. Add a
// member when code first uses it, after checking it on the engine.

import { FUNCTIONS_GLOBAL, REGISTER_FUNCTION } from "../wire/index.ts";
import type { FunctionsGlobal } from "../wire/index.ts";

/** What the main thread's engine provides to the first frame. */
interface FirstFrameGlobals {
	lynx: {
		/** `level` is `"error"` (the default) or `"warning"`. */
		reportError(error: unknown, options?: { level?: "error" | "warning" }): void;
		/** The host's global props (core/renderer/template_entry.cc, UpdateGlobalPropsToContext). */
		__globalProps?: Record<string, unknown> | null;
		/** What Lynx says about the device and itself: on `lynx` here, as a device showed. */
		SystemInfo?: Record<string, unknown>;
	};
}

// Boundary: the engine's globals have no types; this is the one place `globalThis` is typed.
export const firstFrame: FirstFrameGlobals = globalThis as unknown as FirstFrameGlobals;

/** Puts the function that draws the first frame where the main thread's runtime finds it. */
export function setGlobalFunction(name: string, fn: (...args: never[]) => unknown): void {
	// Boundary: the runtime finds it by name on the global object.
	(globalThis as unknown as Record<string, unknown>)[name] = fn;
}

/** Any global, by name. */
// Boundary: the engine's globals have no types; the runtime's are typed where they are read.
const scope = globalThis as unknown as Record<string, unknown>;

/**
 * What the main thread keeps for main-thread functions, shared with its runtime: the page's code
 * and the runtime are separate roots of the main thread's script, and meet only on the global
 * object. Made by whichever loads first.
 */
export function functionsGlobal(): FunctionsGlobal {
	// Boundary: the one object of this name, made here or by the runtime, of this shape.
	return (scope[FUNCTIONS_GLOBAL] ??= {
		bodies: {},
		nextFirstFrameRef: -1,
	} satisfies FunctionsGlobal) as FunctionsGlobal;
}

/** Puts the function compiled code registers each main-thread function's body with, once. */
export function installRegistry(): void {
	scope[REGISTER_FUNCTION] ??= (
		_kind: string,
		id: string,
		body: FunctionsGlobal["bodies"][string],
	) => {
		functionsGlobal().bodies[id] = body;
	};
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
