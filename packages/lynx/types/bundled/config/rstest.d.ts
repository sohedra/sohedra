// `@sohedra/lynx/config/rstest`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

import type { ExtendConfigFn } from "@rstest/core";
/**
 * A library's tests (no app config): the plugin with `options`, as the app using the library would
 * set them. Throws when an option is unknown or has a wrong value, or when the app lacks what the
 * tests run with: `@rstest/core`, `jsdom` and `@testing-library/dom`.
 */
export function withSvelteLynx(options?: PluginSvelteLynxOptions): ExtendConfigFn;
/**
 * An app's tests: its own build config (and with it, its `pluginSvelteLynx` options), through
 * `@rstest/adapter-rsbuild`. Throws when the app lacks what the tests run with, or that adapter.
 */
export function withSvelteLynxFromConfig(options?: ConfigFileOptions): ExtendConfigFn;
/** Where an app's root and its build config file are. */
export interface ConfigFileOptions {
	/**
	 * The app's root.
	 * @defaultValue the working directory
	 */
	rootPath?: string;
	/**
	 * The app's build config file.
	 * @defaultValue `lynx.config.*` (rspeedy), else `rsbuild.config.*`
	 */
	configPath?: string;
}
/**
 * What a `define` constant is replaced by: a string is the code that takes its place (write a
 * string value as `JSON.stringify("x")`, as in Rsbuild's `source.define`); a number, a boolean or
 * `null` is written as it is.
 */
type DefineValue = string | number | boolean | null;
/** The constants of `define`, by the thread whose code they are replaced in. */
interface DefineByThread {
	/** Replaced in everything that runs on the main thread: its script, its functions and the first frame's code. */
	mainThread?: Record<string, DefineValue>;
	/** Replaced in the background thread's code: Svelte and the app. */
	background?: Record<string, DefineValue>;
}
/** The options of `pluginSvelteLynx`. */
interface PluginSvelteLynxOptions {
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
/** What a page-config key takes: Lynx's page config has booleans, numbers, strings and lists of strings. */
type PageConfigValue = boolean | number | string | string[];
/** Page-config keys and their values. */
type PageConfig = Record<string, PageConfigValue>;

export {};
