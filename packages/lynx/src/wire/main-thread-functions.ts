// What the compiled code of a main-thread function and the main thread's runtime agree on.
// Each thread's copy of a function is an object, and the main thread registers the body under
// the object's id.

/** The module whose exports compiled main-thread functions import; each thread resolves its own. */
export const MAIN_THREAD_FUNCTIONS_ENTRY = "@sohedra/lynx/internal/main-thread-functions";

/**
 * The fields of the object that stands for a main-thread function. The engine reads `id` to find
 * the registered body and runs it with the object as `this`. The background sets `context` when
 * it sends the object, to name the background functions the main thread may call through it.
 * `type` is reserved: nothing sets it yet, and no captured value can take its place, since
 * captures live under `captures`.
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
	[FUNCTION_FIELDS.background]?: Record<string, unknown>;
	/** The background's id for this copy, when it sent one. */
	[FUNCTION_FIELDS.context]?: number;
}

/** The engine's global that registers a body under an id. */
export const REGISTER_FUNCTION = "registerWorkletInternal";

/** What the main thread's copy of a handle to a background function is: the first frame has no background yet. */
export const FIRST_FRAME_HANDLE = "{ _isFirstScreen: true }";

/** The exports of `MAIN_THREAD_FUNCTIONS_ENTRY` that compiled code imports. */
export const FUNCTION_RUNTIME = {
	/** Main thread: whether the runtime for registrations is there. */
	load: "loadWorkletRuntime",
	/** Background: turns a background function into the handle a main-thread function holds. */
	handle: "transformToWorklet",
} as const;
