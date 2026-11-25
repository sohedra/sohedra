// What the compiled code of a main-thread function, the app's main-thread script and the main
// thread's runtime agree on. Each thread's copy of a function is an object, and the main thread
// registers the body under the object's id.

/** The module whose exports compiled main-thread functions import; each thread resolves its own. */
export const MAIN_THREAD_FUNCTIONS_ENTRY = "@sohedra/lynx/internal/main-thread-functions";

/**
 * The fields of the object that stands for a main-thread function. The main thread finds the
 * registered body by `id` and runs it with a copy of the object as `this`. The background sets
 * `context` when it sends the object, to name the background functions the main thread may call
 * through it. `type` is reserved: nothing sets it yet, and no captured value can take its place,
 * since captures live under `captures`.
 */
export const FUNCTION_FIELDS = {
	id: "_wkltId",
	captures: "_c",
	background: "_jsFn",
	context: "_execId",
	type: "_type",
} as const;

/** A main-thread function as it travels: in an attribute, a gesture, or a call of the patch. */
export interface MainThreadFunction {
	/** The id of its registered body. */
	[FUNCTION_FIELDS.id]: string;
	/** The values it captured, by name. */
	[FUNCTION_FIELDS.captures]?: Record<string, unknown>;
	/** The handles of the background functions it calls, by name. */
	[FUNCTION_FIELDS.background]?: Record<string, BackgroundFunctionHandle>;
	/** The background's id for this copy, when it sent one. */
	[FUNCTION_FIELDS.context]?: number;
}

/**
 * The fields of a handle to a background function, which a main-thread function holds for each
 * `runOnBackground(fn)` it makes. `id` names the function on the background, within the context of
 * the copy that holds the handle; the main thread writes that `context` onto the handle. The first
 * frame's copy has no background yet: its handles are `firstFrame` alone until hydration names
 * their background functions.
 */
export const HANDLE_FIELDS = {
	id: "_jsFnId",
	context: "_execId",
	firstFrame: "_isFirstScreen",
} as const;

/** A handle to a background function, as it travels. */
export interface BackgroundFunctionHandle {
	[HANDLE_FIELDS.id]?: number;
	[HANDLE_FIELDS.context]?: number;
	[HANDLE_FIELDS.firstFrame]?: true;
}

/**
 * The fields of a main-thread ref as it travels: `id` names it, and the main thread makes it from
 * `initial` the first time it sees the id. The background's ids are positive and the first
 * frame's negative, and neither is ever given twice. `type` is reserved for typed main-thread
 * objects, as Lynx's own refs reserve it.
 */
export const REF_FIELDS = {
	id: "_wvid",
	initial: "_initValue",
	type: "_type",
} as const;

/** A main-thread ref as it travels. */
export interface MainThreadRefHandle {
	[REF_FIELDS.id]: number;
	[REF_FIELDS.initial]?: unknown;
	[REF_FIELDS.type]?: string;
}

/** Whether `value` is a main-thread function as it travels. */
export function isMainThreadFunction(value: unknown): value is MainThreadFunction {
	return typeof value === "object" && value !== null && FUNCTION_FIELDS.id in value;
}

/**
 * Whether `value` is a main-thread ref as it travels. Read as a plain property: on the main thread
 * the value may be the engine's own, which refuses `Reflect.get` on Android.
 */
export function isRefHandle(value: unknown): value is MainThreadRefHandle {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as Record<string, unknown>)[REF_FIELDS.id] === "number"
	);
}

/** Whether `value` is a handle to a background function, the first frame's or the background's. */
export function isBackgroundHandle(value: unknown): value is BackgroundFunctionHandle {
	return (
		typeof value === "object" &&
		value !== null &&
		(HANDLE_FIELDS.id in value || HANDLE_FIELDS.firstFrame in value)
	);
}

/** The global the page's code registers a body with: compiled code calls it by this name. */
export const REGISTER_FUNCTION = "registerWorkletInternal";

/**
 * The global the engine calls to run a main-thread function: `runWorklet(value, params, {
 * source })`, with the value it was given for an event (`source` 1, `params` `[event]`) or a
 * gesture's callback (`source` 2, `params` `[event, gestureManager]`).
 */
export const RUN_FUNCTION = "runWorklet";

/** The engine's `RunWorkletType`: what a call of `RUN_FUNCTION` runs. */
export const RUN_SOURCE = { event: 1, gesture: 2 } as const;

/** What the main thread's copy of a handle to a background function is: the first frame has no background yet. */
export const FIRST_FRAME_HANDLE: string = `{ ${HANDLE_FIELDS.firstFrame}: true }`;

/** The exports of `MAIN_THREAD_FUNCTIONS_ENTRY` that compiled code imports. */
export const FUNCTION_RUNTIME = {
	/** Main thread: whether the runtime for registrations is there. */
	load: "loadWorkletRuntime",
	/** Background: turns a background function into the handle a main-thread function holds. */
	handle: "transformToWorklet",
	/** Background: copies a captured `$state` value, reading it whole. */
	copy: "copyCapture",
} as const;

/**
 * The global where the main thread keeps what lives as long as its runtime: the registered bodies,
 * and the page's runtime of main-thread functions. The app's main-thread script reaches the
 * runtime only through it: they are separate roots of one script.
 */
export const FUNCTIONS_GLOBAL = "__sohedraLynxFunctions";

/** What `FUNCTIONS_GLOBAL` holds. */
export interface FunctionsGlobal {
	/** The bodies, by id, as the page's code registered them. */
	bodies: Record<string, (this: unknown, ...args: never[]) => unknown>;
	/** The page's runtime, once the main thread's runtime started. */
	runtime?: FunctionsRuntime;
	/** The next id of a ref the first frame makes: negative, and never given twice. */
	nextFirstFrameRef: number;
}

/** What the app's main-thread script asks of the main thread's runtime. */
export interface FunctionsRuntime {
	/** `runOnBackground(handle)(...params)` from a main-thread function. */
	runOnBackground(handle: unknown, params: unknown[]): Promise<unknown>;
	/** `runOnMainThread(fn)(...params)` from a main-thread function: it runs at once. */
	runOnMainThread(fn: unknown, params: unknown[]): Promise<unknown>;
	/** `reportError(error)` from a main-thread function: into Lynx, and to the page's `onError`. */
	reportError(error: unknown): void;
}
