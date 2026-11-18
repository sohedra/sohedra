// `@sohedra/lynx/internal/main-thread-functions` on the background, which compiled main-thread
// functions import: the handle of each background function they call. Its main-thread side is
// ../first-frame/functions-entry.ts.

export { transformToWorklet } from "./functions/calls.ts";

/** Whether the main thread's runtime for registrations is there: never on the background. */
export function loadWorkletRuntime(): boolean {
	return false;
}
