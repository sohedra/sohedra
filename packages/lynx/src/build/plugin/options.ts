// The options of `pluginSvelteLynx()`, as the plugin reads them.

import { MIN_ENGINE_VERSION } from "./engine-version.ts";
import type { PageConfig } from "./page-config.ts";

export type { PageConfig, PageConfigValue } from "./page-config.ts";

/**
 * What a `define` constant is replaced by: a string is the code that takes its place (write a
 * string value as `JSON.stringify("x")`, as in Rsbuild's `source.define`); a number, a boolean or
 * `null` is written as it is.
 */
export type DefineValue = string | number | boolean | null;

/** The constants of `define`, by the thread whose code they are replaced in. */
export interface DefineByThread {
	/** Replaced in everything that runs on the main thread: its script, its functions and the first frame's code. */
	mainThread?: Record<string, DefineValue>;
	/** Replaced in the background thread's code: Svelte and the app. */
	background?: Record<string, DefineValue>;
}

/** The options of `pluginSvelteLynx`. */
export interface PluginSvelteLynxOptions {
	/**
	 * The oldest Lynx engine version the bundle runs on. The binding builds for Lynx 4.2 and later,
	 * and its encoder encodes for Lynx 4.3 at most: a version outside them fails when the plugin is
	 * made.
	 * @defaultValue '4.2'
	 */
	engineVersion?: string;
	/**
	 * Draw each page's first frame on the main thread while Lynx renders it, from the page that
	 * Svelte's server renderer makes with the host's init data, so there is no empty frame while the
	 * background thread starts. A function of the entry's name draws the first frame of some pages
	 * and not of others; it is called once for each entry when the build starts. When no page of the
	 * build draws its first frame, the main thread's script also leaves out the code that draws and
	 * hydrates it; when some do, every page keeps that code, since the pages share it.
	 * @defaultValue true
	 */
	firstFrame?: boolean | ((entryName: string) => boolean);
	/**
	 * Constants that differ by thread: each key is replaced by its value at build time in that
	 * thread's code. A key is a plain identifier (`__API__`, not `process.env.API`); the plugin's
	 * own (`__MAIN_THREAD__`, `__BACKGROUND__`, `__LEPUS__`, `__JS__`, `__DEV__`, `__FIRST_FRAME__`)
	 * cannot be set.
	 *
	 * ```ts
	 * pluginSvelteLynx({
	 *   define: {
	 *     mainThread: { __STORE__: JSON.stringify("first-frame") },
	 *     background: { __STORE__: JSON.stringify("live") },
	 *   },
	 * });
	 * ```
	 */
	define?: DefineByThread;
	/**
	 * Packages to bundle once, besides `svelte` and `@sohedra/lynx`, which always are: a library that
	 * keeps state both threads' code share, or that imports Svelte's internals, breaks when a linked
	 * or nested package brings a second install. Every import of a listed package resolves from the
	 * app's folder on both threads, so the app must be able to resolve it.
	 */
	dedupe?: string[];
	/**
	 * Settings of the page that Lynx's engine reads: `enableCSSRule`, `longPressDuration`,
	 * `enableCSSInheritance` and the rest. The engine checks the keys, so a misspelt one is passed
	 * on as it is. The keys the plugin sets itself (`enableA11y`, `targetSdkVersion`, `dsl` and the
	 * rest) cannot be set, and the engine's newer paths are always on. What `pluginLynxConfig` sets
	 * wins.
	 */
	pageConfig?: PageConfig;
	/** Where Svelte's options come from. */
	svelte?: {
		/**
		 * The Svelte config file, relative to the app's folder. Without it, the plugin looks for
		 * `svelte.config.js`, `.mjs`, `.ts` and `.mts` there.
		 */
		configFile?: string;
	};
}

/** The plugin's options with their defaults. */
export interface ResolvedOptions {
	engineVersion: string;
	/** A boolean, or the app's function of the entry's name. */
	firstFrame: boolean | ((entryName: string) => boolean);
	/** The code each thread's constants are replaced by. */
	define: Record<"mainThread" | "background", Record<string, string>>;
	dedupe: string[];
	pageConfig: PageConfig | undefined;
	configFile: string | undefined;
}

/** `define`'s values as the code that replaces each constant. */
export function defineCode(
	define: Record<string, DefineValue> | undefined,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(define ?? {}).map(([key, value]) => [
			key,
			typeof value === "string" ? value : JSON.stringify(value),
		]),
	);
}

/** The options with their defaults, once they are checked. */
export function resolveOptions(options: PluginSvelteLynxOptions): ResolvedOptions {
	return {
		engineVersion: options.engineVersion ?? MIN_ENGINE_VERSION,
		firstFrame:
			typeof options.firstFrame === "function" ? options.firstFrame : options.firstFrame !== false,
		define: {
			mainThread: defineCode(options.define?.mainThread),
			background: defineCode(options.define?.background),
		},
		dedupe: options.dedupe ?? [],
		pageConfig: options.pageConfig,
		configFile: options.svelte?.configFile,
	};
}

/**
 * Whether each entry draws its first frame: `firstFrame` is called once for each entry name (a
 * boolean is the same for all). Returns the answers, or the entry whose answer is not a boolean.
 */
export function entryFirstFrames(
	firstFrame: ResolvedOptions["firstFrame"],
	entryNames: string[],
): Map<string, boolean> | { entry: string; given: unknown } {
	const drawn = new Map<string, boolean>();
	for (const entry of entryNames) {
		const value: unknown = typeof firstFrame === "function" ? firstFrame(entry) : firstFrame;
		if (typeof value !== "boolean") return { entry, given: value };
		drawn.set(entry, value);
	}
	return drawn;
}
