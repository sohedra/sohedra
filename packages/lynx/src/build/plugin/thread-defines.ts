// The constants each thread's code is compiled with.

import type { Thread } from "../../wire/index.ts";

/** What a build says about itself to the constants. */
interface DefineFlags {
	/** A development build. */
	development: boolean;
	/** Whether any entry draws its first frame. */
	firstFrame: boolean;
}

/**
 * The constants for app and library code, with ReactLynx's names beside the binding's: `__LEPUS__`
 * and `__JS__` are the main thread (Lynx's Lepus engine) and the background thread, which packages
 * written for Lynx read.
 */
export function threadDefines(thread: Thread, development: boolean): Record<string, string> {
	const mainThread = thread === "main-thread";
	return {
		__MAIN_THREAD__: String(mainThread),
		__BACKGROUND__: String(!mainThread),
		__LEPUS__: String(mainThread),
		__JS__: String(!mainThread),
		__DEV__: String(development),
	};
}

/**
 * The background's reads of `fetch`: the global object's when there is one
 * (`@sohedra/lynx-polyfill` puts it there), else lynx-core's, as before. Lynx's runtime wrapper
 * passes the background's bundle lynx-core's `fetch` as a parameter of that name, which its own code
 * reads (`fetch = fetch || lynx.fetch`), so the parameter can't be renamed, and a fill can't reach
 * it. SWC replaces only reads of the free name: an assignment or a declaration stays as written.
 * The main thread keeps its reads, whose `ReferenceError` names the import that fills `fetch`.
 *
 * @workaround wrapper-fetch-parameter kind=lynx-limit delete-when="Lynx's runtime wrapper no longer passes the bundle a fetch parameter"
 */
const BACKGROUND_FETCH = "(globalThis.fetch || lynx.fetch)";

/** The constants of a build: the thread's, and the first frame's flag the runtime reads. */
export function pluginDefines(thread: Thread, flags: DefineFlags): Record<string, string> {
	return {
		...threadDefines(thread, flags.development),
		__FIRST_FRAME__: String(flags.firstFrame),
		...(thread === "background" && { fetch: BACKGROUND_FETCH }),
	};
}

/** The constants the plugin sets itself in every build: `define` cannot set them. */
export const PLUGIN_DEFINE_KEYS: readonly string[] = Object.keys(
	pluginDefines("main-thread", { development: false, firstFrame: false }),
);
