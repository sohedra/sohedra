// `@sohedra/lynx/internal/main-thread-functions` on the background, which compiled main-thread
// functions import: the handle of each background function they call, and the copy of each `$state`
// value they capture. Its main-thread side is ../first-frame/functions-entry.ts.

export { transformToWorklet } from "./functions/calls.ts";
export { copyCapture } from "./functions/capture-copy.ts";

/** Whether the main thread's runtime for registrations is there: never on the background. */
export function loadWorkletRuntime(): boolean {
	return false;
}
