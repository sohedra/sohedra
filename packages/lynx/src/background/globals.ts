// The globals of Lynx's background thread, as this folder's code may use them. Add a member when
// code first uses it, after checking it on the engine.

/** What `lynx.getNativeApp()` answers: the way to the main thread's functions. */
export interface NativeApp {
	callLepusMethod(name: string, params: unknown, callback?: () => void): void;
}

/** A message the main thread sent, as a listener of `lynx.getCoreContext()` gets it. */
export interface CoreMessage {
	type: string;
	data: unknown;
}

/** What `lynx.getCoreContext()` answers: where the main thread's messages arrive. */
export interface CoreContext {
	addEventListener(type: string, listener: (message: CoreMessage) => void): void;
	removeEventListener(type: string, listener: (message: CoreMessage) => void): void;
}

/**
 * What `lynx.getApp()` answers: the app the engine calls on the background. The page puts its
 * hooks there, as ReactLynx does.
 */
export type App = Record<string, unknown>;

/** What the background thread's engine provides. */
export interface BackgroundGlobals {
	lynx: {
		/** The page's data, as the host opened it and as updates left it. */
		__initData: Record<string, unknown>;
		/** `level` is `"error"` (the default) or `"warning"`. */
		reportError(error: unknown, options?: { level?: "error" | "warning" }): void;
		queueMicrotask(callback: () => void): void;
		setTimeout(callback: () => void, delay?: number): number;
		clearTimeout(id: number): void;
		setInterval(callback: () => void, delay?: number): number;
		clearInterval(id: number): void;
		getNativeApp(): NativeApp;
		getCoreContext(): CoreContext;
		getApp(): App;
	};
}

// On a device the background's `lynx` is not on the global object: it is a parameter of the
// function the bundle's wrapper hands lynx-core (lynx-core's app.ts, `require`), so it is read by
// its name, which resolves to that parameter, as ReactLynx reads it.
declare const lynx: BackgroundGlobals["lynx"];

/** The background's globals, each read when it is used. */
export const background: BackgroundGlobals = {
	get lynx() {
		return lynx;
	},
};

/** A global object, its values by name. */
type Scope = Record<string, unknown>;

// Boundary: what the engine lacks is filled in there by name.
/** The background's global object, where start-up fills in what the engine lacks. */
export const globalScope: Scope = globalThis as unknown as Scope;

declare const __DEV__: boolean;

/** `true` in a development build: the build replaces it, and drops what it guards otherwise. */
export const DEV: boolean = __DEV__;
