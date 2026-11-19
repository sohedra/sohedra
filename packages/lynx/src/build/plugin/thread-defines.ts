// The constants each thread's code is compiled with.

import type { Thread } from "../../wire/index.ts";

/** What a build says about itself to the constants. */
export interface DefineFlags {
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

/** The constants of a build: the thread's, and the first frame's flag the runtime reads. */
export function pluginDefines(thread: Thread, flags: DefineFlags): Record<string, string> {
	return {
		...threadDefines(thread, flags.development),
		__FIRST_FRAME__: String(flags.firstFrame),
	};
}

/** The constants the plugin sets itself in every build: `define` cannot set them. */
export const PLUGIN_DEFINE_KEYS: readonly string[] = Object.keys(
	pluginDefines("main-thread", { development: false, firstFrame: false }),
);
