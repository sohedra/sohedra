// A test page: the engine fake as the main thread's globals, a `lynx` for each thread, and the
// bridge between them. The page's own scripts start where a device starts them: the main thread's
// before the engine renders, the background's after. They are the runtime's and the app's; a test
// passes them, and nothing runs in their place.

import { FIRST_FRAME_GLOBAL, PATCH_METHOD } from "../../wire/index.ts";
import { createEngine } from "../engine/create-engine.ts";
import type { Engine } from "../engine/create-engine.ts";
import {
	activeSession,
	installGlobals,
	readGlobal,
	removeGlobals,
	setActiveSession,
} from "../globals.ts";
import { createBridge } from "./bridge.ts";
import { createBundles } from "./bundles.ts";
import type { TestBundle } from "./bundles.ts";
import { createHostEvents } from "./host.ts";
import type { HostEventsLog } from "./host.ts";
import { createLynx } from "./lynx.ts";
import type { BackgroundLynx, MainThreadLynx, TestApp, Thread } from "./lynx.ts";

/** What a test page starts with. */
export interface TestPageOptions {
	/**
	 * The data the host opens the page with. The engine renders the page with the template's data
	 * and this over it, and gives the background this as `_params.updateData`
	 * (core/runtime/js/bindings/js_app.cc).
	 */
	initData?: Record<string, unknown>;
	/** The template's own data, which the engine gives the background as `_params.initData`. */
	templateData?: Record<string, unknown>;
	/** The host's global props. */
	globalProps?: Record<string, unknown>;
	/**
	 * What Lynx says about the device: the background's global `SystemInfo` and the main thread's
	 * `lynx.SystemInfo`. An iPhone's by default.
	 */
	systemInfo?: Record<string, unknown>;
	/** The page's own URL, which lynx-core's app keeps as `srcName`. */
	url?: string;
	/** The lazy bundles the page can fetch, by URL. */
	bundles?: Record<string, TestBundle>;
	/** The main thread's script: it runs first, before the engine renders the page. */
	mainThread?: () => void;
	/** The background's script, the app: it runs once the engine has rendered the page. */
	background?: () => void;
	/** The document the elements are made in; the test environment's by default. */
	document?: Document;
	/** The element the page goes in; the document's body by default. */
	container?: Element;
}

/** A running test page. */
export interface TestPage {
	/** The engine fake the page runs on. */
	readonly engine: Engine;
	/**
	 * Each thread's `lynx`. The global `lynx` is the one of the thread that ran last: each thread's
	 * code finds its own when it runs, and so do the microtasks it leaves.
	 */
	readonly lynx: { readonly mainThread: MainThreadLynx; readonly background: BackgroundLynx };
	/**
	 * What the page reported with `lynx.reportError`, what a thread threw while it handled what the
	 * other sent, and what Lynx would report about the page.
	 */
	readonly errors: unknown[];
	/** What the page reported with `lynx.reportError` at the warning level. */
	readonly warnings: unknown[];
	/** The app the engine calls the page's hooks on, on the background. */
	readonly app: TestApp;
	/**
	 * The host updates the page's data: the engine updates the page on the main thread, then posts
	 * the data to the app's `updateCardData`, with its `type` (core/runtime/js/bindings/js_app.cc,
	 * NotifyUpdatePageData). Type 1 starts the data from none.
	 */
	updateData(data: Record<string, unknown>, options?: { type?: number }): void;
	/**
	 * The host updates its global props, which the platform merges into the ones it has: the engine
	 * gives the main thread all of them and calls its `updateGlobalProps`, then posts them to the
	 * app's `updateGlobalProps` (lynx-core's app.ts, `__NotifyGlobalPropsUpdated`).
	 */
	updateGlobalProps(props: Record<string, unknown>): void;
	/**
	 * The host sends a global event: lynx-core's `GlobalEventEmitter` emits it on the background, on
	 * a later task. What a listener throws, lynx-core reports.
	 */
	emitHostEvent(name: string, args: unknown[]): void;
	/** What the page asked of lynx-core's `GlobalEventEmitter`. */
	readonly hostEvents: HostEventsLog;
	/**
	 * The host reloads the page, with data to add: the engine removes the main thread's components,
	 * posts the data to the app's `onAppReload` (js_app.cc, OnAppReload), then updates the main
	 * thread's page with `reloadTemplate`, in one task (core/renderer/template_assembler.cc,
	 * ReloadTemplate): the background hears of it after the main thread.
	 */
	reload(data?: Record<string, unknown>): void;
	/**
	 * The page's life ends: the native side tells the main thread, then the app's
	 * `callDestroyLifetimeFun` runs on the background (js_app.cc, CallDestroyLifetimeFun). Once it
	 * returns, the engine frees the background's runtime, as Lynx 4.2 does on Android: what the
	 * background queued does not run, and nothing it reports reaches Lynx. A promise's reaction runs
	 * all the same here, on the process's own queue, but what it reports is dropped.
	 */
	destroy(): void;
	/** Runs `code` as the main thread's, with that thread's globals in place, as the engine runs it. */
	asMainThread<T>(code: () => T): T;
	/** Runs `code` as the background's, with that thread's globals in place. */
	asBackground<T>(code: () => T): T;
	/** Waits until nothing crosses between the threads and the engine has answered. */
	settle(): Promise<void>;
	/** Ends the page: its end is said, its elements leave the document, the globals are put back. */
	dispose(): void;
}

/** What an iPhone's Lynx says about it: what a test page's Lynx says by default. */
export const IPHONE: Readonly<Record<string, unknown>> = {
	platform: "iOS",
	osVersion: "18.0",
	engineVersion: "3.2",
	lynxSdkVersion: "3.2",
	pixelWidth: 1170,
	pixelHeight: 2532,
	pixelRatio: 3,
	runtimeType: "quickjs",
};

/**
 * What neither of Lynx's threads has (the device checks: `queueMicrotask is not defined` on Lynx
 * 4.2's main thread, and Svelte's `EventTarget` and `structuredClone` missing on both): each thread
 * has only what its own code puts there, the binding's fills.
 */
const THREAD_FILLED = ["queueMicrotask", "EventTarget", "structuredClone"];

/** The globals a page's own code sets while it runs, put back when the page ends. */
const PAGE_GLOBALS = [
	...THREAD_FILLED,
	"runWorklet",
	"renderPage",
	"updatePage",
	"updateGlobalProps",
	"removeComponents",
	"processData",
	PATCH_METHOD,
	FIRST_FRAME_GLOBAL,
];

/** Starts a test page, and ends the one that was running, if any. */
export function startTestPage(options: TestPageOptions = {}): TestPage {
	activeSession()?.dispose();
	const errors: unknown[] = [];
	const warnings: unknown[] = [];
	const bridge = createBridge((error) => void errors.push(error));
	let ended = false;
	let destroyed = false;
	/** The engine freed the background's runtime: `callDestroyLifetimeFun` has returned. */
	let freed = false;
	/**
	 * Puts the thread's globals in place, before that thread's code runs: its `lynx`, and Lynx's
	 * element functions on the main thread only. On a device the background has none, so a call of
	 * one there fails as it would.
	 */
	let current: Thread | undefined;
	/** Each thread's own of `THREAD_FILLED`: none until its code fills them. */
	const filled: Record<Thread, Record<string, unknown>> = { "main-thread": {}, background: {} };
	const enter = (thread: Thread): Thread | undefined => {
		const before = current;
		if (ended) return before;
		if (thread !== current) {
			// What the thread's own code left there stays its own.
			if (current) for (const name of THREAD_FILLED) filled[current][name] = readGlobal(name);
			const own = filled[thread];
			removeGlobals(THREAD_FILLED.filter((name) => own[name] === undefined));
			installGlobals(
				Object.fromEntries(
					THREAD_FILLED.flatMap((name) => (own[name] === undefined ? [] : [[name, own[name]]])),
				),
			);
		}
		current = thread;
		if (thread === "main-thread") {
			installGlobals({ ...engine.functions, lynx: lynx.mainThread, SystemInfo: systemInfo });
			return before;
		}
		installGlobals({ lynx: lynx.background, SystemInfo: systemInfo, ...backgroundFrames });
		removeGlobals(mainThreadOnly);
		return before;
	};
	const engine = createEngine({
		...(options.document && { document: options.document }),
		...(options.container && { container: options.container }),
		schedule: bridge.send,
		enter: () => enter("main-thread"),
		report: (error) => void errors.push(error),
	});
	/**
	 * lynx-core gives the background a `requestAnimationFrame` of its own, through the app's frames
	 * (lynx-core's common/amd.ts, app.ts): the process's stands in for it there.
	 */
	const processFrame = readGlobal("requestAnimationFrame");
	const backgroundFrames: Record<string, unknown> =
		processFrame === undefined ? {} : { requestAnimationFrame: processFrame };
	const mainThreadOnly = Object.keys(engine.functions).filter(
		(name) => !(name in backgroundFrames),
	);
	const templateData = options.templateData ?? {};
	const hostData = options.initData ?? {};
	// The data the engine renders the page with (core/renderer/template_assembler.cc).
	const initData = { ...templateData, ...hostData };
	const app: TestApp = {
		_params: {
			initData: { ...templateData },
			updateData: { ...hostData },
			...(options.url !== undefined && { srcName: options.url }),
		},
	};
	const systemInfo = options.systemInfo ?? IPHONE;
	const hostEvents = createHostEvents();
	const bundles = options.bundles ?? {};
	for (const [url, bundle] of Object.entries(bundles))
		if (bundle.styles !== undefined) engine.provideStyleSheet(url, bundle.styles);
	const lynx = createLynx({
		bridge,
		lifecycle: engine.lifecycle,
		initData,
		globalProps: options.globalProps ?? {},
		errors,
		warnings,
		app,
		enter,
		getJSModule: hostEvents.getJSModule,
		bundles: createBundles(bundles),
		systemInfo,
		freed: () => freed,
	});
	/**
	 * Calls a hook of the app, as the engine does: a missing one is skipped (js_app.cc, which
	 * looks it up with `getPropertyAsFunction` and returns when there is none).
	 */
	const callApp = (name: string, ...args: unknown[]): void => {
		enter("background");
		const hook = app[name];
		if (typeof hook === "function") hook.apply(app, args);
	};
	const toBackground = (name: string, ...args: unknown[]): void =>
		bridge.send(() => callApp(name, ...args));
	// On a device, Lynx's element functions are the main thread's globals.
	const restoreGlobals = installGlobals(
		{ ...engine.functions, lynx: lynx.mainThread, SystemInfo: systemInfo },
		PAGE_GLOBALS,
	);

	const page: TestPage = {
		engine,
		lynx,
		errors,
		warnings,
		app,
		updateData(data, updateOptions = {}) {
			engine.lifecycle.update(data, {});
			toBackground("updateCardData", data, { type: updateOptions.type ?? 0 });
		},
		updateGlobalProps(props) {
			const merged = { ...lynx.mainThread.__globalProps, ...props };
			enter("main-thread");
			lynx.mainThread.__globalProps = merged;
			// The engine calls the main thread's function by name (core/renderer/template_assembler.cc).
			const update = readGlobal("updateGlobalProps");
			if (typeof update === "function") update(merged, {});
			toBackground("updateGlobalProps", merged);
		},
		emitHostEvent(name, args) {
			bridge.send(() => {
				enter("background");
				// lynx-core calls the emitter through `callFunction`, which reports what it throws.
				try {
					hostEvents.emitter.emit(name, args);
				} catch (error) {
					errors.push(error);
				}
			});
		},
		hostEvents: hostEvents.log,
		reload(data = {}) {
			engine.lifecycle.removeComponents();
			toBackground("onAppReload", data);
			engine.lifecycle.update(data, { reloadTemplate: true });
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			engine.lifecycle.destroy();
			bridge.send(() => {
				try {
					callApp("callDestroyLifetimeFun");
				} finally {
					freed = true;
				}
			});
		},
		asMainThread(code) {
			enter("main-thread");
			return code();
		},
		asBackground(code) {
			enter("background");
			return code();
		},
		settle: bridge.settle,
		dispose() {
			if (ended) return;
			if (activeSession() === page) setActiveSession(undefined);
			if (!destroyed) {
				destroyed = true;
				engine.lifecycle.destroy();
				try {
					callApp("callDestroyLifetimeFun");
				} catch (error) {
					errors.push(error);
				} finally {
					freed = true;
				}
			}
			ended = true;
			bridge.close();
			restoreGlobals();
			engine.dispose();
		},
	};
	setActiveSession(page);

	enter("main-thread");
	options.mainThread?.();
	engine.lifecycle.render(initData);
	// The engine ends a render with a flush of the tree (core/renderer/template_assembler.cc,
	// OnPatchFinish after RenderPage).
	engine.functions.__FlushElementTree();
	enter("background");
	options.background?.();
	return page;
}
