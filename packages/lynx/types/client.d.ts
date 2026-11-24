// Ambient types for an app built with @sohedra/lynx. One line in the app sets them up:
//
//   /// <reference types="@sohedra/lynx/client" />
//
// - the build's own types, from Rsbuild (`import.meta.webpackHot`, asset imports, CSS modules):
//   the file rspeedy's client types refer to, so an app built with Rsbuild alone needs no
//   `@lynx-js/rspeedy`;
// - Lynx's elements for the Svelte language tools (elements.d.ts), which they read with
//   `"svelteOptions": { "namespace": "svelteLynx" }` in tsconfig.json;
// - `esm-env`, which the binding resolves from Svelte, and `background-only`, which it provides;
// - the globals a Lynx thread has without `@sohedra/lynx-polyfill`: its own, or the binding's where
//   one thread lacks it. Each says which thread has it; the build reports a read of one on a thread
//   without it. What the polyfill fills (`URL`, `fetch`, `TextEncoder`…) its imports declare, and a
//   global no thread has (`window`, `document`, `localStorage`) stays a type error.

/// <reference types="@rsbuild/core/types" />
// oxlint-disable-next-line typescript/triple-slash-reference -- an import would make this file a module, which turns its `declare module`s into augmentations
/// <reference path="./elements.d.ts" />

// The globals are `var`s and `function`s, as the DOM's and Node's types declare theirs, so that a
// check with those too merges the declarations.
/* oxlint-disable no-var */

// `.svelte` imports, for plain `tsc`, are Svelte's own: declaring them here too would declare them
// twice for an app that checks every declaration file.

/** Svelte's environment flags. */
declare module "esm-env" {
	/** `true` on the background thread; `false` on the main thread, which draws the first frame. */
	export const BROWSER: boolean;
	/** `true` in a development build. */
	export const DEV: boolean;
	/** `false`: Lynx is not Node. */
	export const NODE: boolean;
}

/**
 * `import "background-only"` keeps a module off the main thread: there it is a stub, and using it
 * while the first frame renders throws. Use what it exports in `onMount`, `$effect` or event
 * handlers, which run on the background thread.
 */
declare module "background-only" {}

/** What a thread's `console` has on Lynx. */
interface Console {
	debug(...data: unknown[]): void;
	error(...data: unknown[]): void;
	group(...label: unknown[]): void;
	groupEnd(): void;
	info(...data: unknown[]): void;
	log(...data: unknown[]): void;
	warn(...data: unknown[]): void;
}

/** Logs to Lynx's console: the host's log, and the developer tools'. Both threads. */
declare var console: Console;

/**
 * Runs `callback` once, `delay` milliseconds from now (0 when left out), on the thread that called
 * it; answers what `clearTimeout` takes. Both threads.
 */
declare function setTimeout(callback: () => void, delay?: number): number;
/** Cancels what `setTimeout` answered. Both threads. */
declare function clearTimeout(id: number | undefined): void;
/** Runs `callback` every `delay` milliseconds; answers what `clearInterval` takes. Both threads. */
declare function setInterval(callback: () => void, delay?: number): number;
/** Cancels what `setInterval` answered. Both threads. */
declare function clearInterval(id: number | undefined): void;
/**
 * Runs `callback` before the thread's next frame, with that frame's time in milliseconds; answers
 * what `cancelAnimationFrame` takes. Both threads.
 */
declare function requestAnimationFrame(callback: (time: number) => void): number;
/** Cancels what `requestAnimationFrame` answered. Both threads. */
declare function cancelAnimationFrame(id: number): void;
/**
 * Runs `callback` once the current task's code has run, before anything else does. Both threads:
 * the background's own, and the binding's on the main thread, which lacks one.
 */
declare function queueMicrotask(callback: () => void): void;

/**
 * Lynx's `lynx` object: the members an app calls. Add to it, as `declare global { interface Lynx {
 * … } }`, for a member of Lynx's own it does not list. Both threads have `lynx`; a member says if
 * one thread has it only.
 */
interface Lynx {
	/**
	 * Reports an error into Lynx: LogBox shows it, as a warning at `level: "warning"`. Both threads.
	 * `reportError` of `@sohedra/lynx` also sends it to the page's `onError`.
	 */
	reportError(error: string | Error, options?: { level?: "error" | "warning" }): void;
	/** A module of Lynx's background runtime, by name, such as `GlobalEventEmitter`. Background only. */
	getJSModule<Module = unknown>(name: string): Module;
}

/** Lynx's `lynx` object. Both threads. */
declare var lynx: Lynx;

/** What Lynx says about the device and itself. Both threads: the binding's on the main thread. */
// oxlint-disable-next-line typescript/consistent-type-imports -- an import would make this file a module, which turns its globals into a module's
declare var SystemInfo: import("@sohedra/lynx/host").SystemInfo;

/**
 * The host app's native modules, by name. Declare each one your app calls, as
 * `declare global { interface NativeModules { Storage: { get(key: string): string } } }`.
 */
interface NativeModules {
	readonly [name: string]: unknown;
}

/** The host app's native modules, by name. Background only. */
declare var NativeModules: NativeModules;
