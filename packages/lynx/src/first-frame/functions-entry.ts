// `@sohedra/lynx/internal/main-thread-functions` on the main thread, which compiled main-thread
// functions import: whether to register their bodies, which they do with the registry this puts
// in place. Its background side is ../background/functions-entry.ts.

import { HANDLE_FIELDS } from "../wire/index.ts";
import type { BackgroundFunctionHandle } from "../wire/index.ts";
import { installRegistry } from "./globals.ts";

/** Puts the registry for main-thread functions' bodies in place: the page's code registers them. */
export function loadWorkletRuntime(): boolean {
	installRegistry();
	return true;
}

/** The first frame's handle of a background function: it names none until hydration. */
export function transformToWorklet(_fn: unknown): BackgroundFunctionHandle {
	return { [HANDLE_FIELDS.firstFrame]: true };
}
