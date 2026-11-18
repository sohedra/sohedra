// The `lynx` of each thread of a test page. On a device each thread has its own, with only that
// thread's part: the main thread's way to the background and the engine's events, the
// background's way to the main thread and the native app. Everything one thread sends the other
// crosses the page's bridge as a copy, made when it is sent, as a device converts it.

import type { Lifecycle, LifecycleProxy } from "../engine/lifecycle.ts";
import { queueMicrotaskAs, readGlobal } from "../globals.ts";
import type { Bridge } from "./bridge.ts";

/** A thread of the page. */
export type Thread = "main-thread" | "background";

/** What a listener of the other thread's messages gets: a message event. */
export interface ThreadMessage {
	type: string;
	data: unknown;
	/** The context that sent it: `CoreContext` (the main thread) or `JSContext` (the background). */
	origin: string;
}

type MessageListener = (event: ThreadMessage) => void;

/** A thread's way to the other one: `lynx.getJSContext()` or `lynx.getCoreContext()`. */
export interface ThreadContext {
	addEventListener(type: string, listener: MessageListener): void;
	removeEventListener(type: string, listener: MessageListener): void;
	/** Sends a copy of a message to the other thread; its listeners of `type` get it on a later task. */
	dispatchEvent(event: { type: string; data: unknown }): void;
}

/** What `lynx.getNativeApp()` answers on the background. */
export interface NativeApp {
	/**
	 * Calls the main thread's global function `name` with a copy of `params` on a later task, then
	 * `callback` on the background on a task after that.
	 */
	callLepusMethod(name: string, params: unknown, callback?: () => void): void;
}

/** What both threads' `lynx` have. */
interface SharedLynx {
	/** The page's initial data. */
	readonly __initData: Record<string, unknown>;
	/** The host's global props. */
	readonly __globalProps: Record<string, unknown>;
	/**
	 * Reports an error into Lynx, at the `level` given: `"error"`, the default, or `"warning"`
	 * (lynx-core's lynx.ts, reportError). The test page keeps it.
	 */
	reportError(error: unknown, options?: { level?: string }): void;
}

/**
 * The app the engine calls on the background (`lynx.getApp()`): a page puts its hooks on it, and
 * it keeps the data the page was opened with (lynx-core's app, `_params`).
 */
export interface TestApp {
	[hook: string]: unknown;
	_params: { initData: Record<string, unknown>; updateData: Record<string, unknown> };
}

/** The main thread's `lynx`. */
export interface MainThreadLynx extends SharedLynx {
	/** The main thread's way to the background. */
	getJSContext(): ThreadContext;
	/** The engine's events: render, update, remove components. */
	getEngine(): LifecycleProxy;
	/** The native side's events: the page's end. */
	getNative(): LifecycleProxy;
	/**
	 * Runs `callback` on the main thread on a later task, which `settle()` waits for. The delay is
	 * not waited out: only the order is kept.
	 */
	setTimeout(callback: () => void, delay?: number): void;
}

/** The background's `lynx`. */
export interface BackgroundLynx extends SharedLynx {
	/** The background's way to the main thread. */
	getCoreContext(): ThreadContext;
	/** The native app. */
	getNativeApp(): NativeApp;
	/** The app the engine calls the page's hooks on. */
	getApp(): TestApp;
	/**
	 * Runs `callback` on a microtask (lynx-core's lynx.ts, queueMicrotask, which hands it to the
	 * engine's own queue).
	 */
	queueMicrotask(callback: () => void): void;
}

/** What may cross between the threads, to be checked: anything else is named in the error. */
function describe(value: unknown): string | undefined {
	if (typeof value === "function") return "a function";
	if (typeof value === "symbol") return "a symbol";
	if (typeof value === "bigint") return "a bigint";
	if (typeof value === "number" && !Number.isFinite(value)) return `the number ${value}`;
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	// A plain object of any realm: each thread is a realm of its own on a device.
	const prototype: unknown = Object.getPrototypeOf(value);
	if (prototype === null || Object.getPrototypeOf(prototype) === null) return undefined;
	return `an instance of ${value.constructor.name}`;
}

/**
 * A copy of what a thread sends: null, booleans, finite numbers, text, arrays and plain objects.
 * Throws for anything else, naming the message: what Lynx does with a function, an element or a
 * class instance is not verified, and the receiver would not have it as it was.
 */
function copyMessage(type: string, value: unknown, seen: Set<object> = new Set()): unknown {
	const odd = describe(value);
	const refuse = (what: string): Error =>
		new Error(
			`The ${type} message between the threads holds ${what}, which a device does not carry ` +
				"across. Send plain data: null, booleans, finite numbers, text, arrays and plain objects.",
		);
	if (odd) throw refuse(odd);
	if (typeof value !== "object" || value === null) return value;
	if (seen.has(value)) throw refuse("a cycle");
	seen.add(value);
	const copy = Array.isArray(value)
		? value.map((item) => copyMessage(type, item, seen))
		: Object.fromEntries(
				Object.entries(value).map(([key, item]) => [key, copyMessage(type, item, seen)]),
			);
	seen.delete(value);
	return copy;
}

/** One thread's listeners, which the other thread's context tells. */
function createSide(): {
	listeners: Map<string, Set<MessageListener>>;
	tell(event: ThreadMessage): void;
} {
	const listeners = new Map<string, Set<MessageListener>>();
	return {
		listeners,
		tell(event) {
			// oxlint-disable-next-line unicorn/no-useless-spread -- copied: a listener may remove itself while it is told
			for (const listener of [...(listeners.get(event.type) ?? [])]) listener(event);
		},
	};
}

/** Makes the `lynx` of each thread of a test page, over its bridge and its engine's lifecycle. */
export function createLynx(options: {
	bridge: Bridge;
	lifecycle: Lifecycle;
	initData: Record<string, unknown>;
	globalProps: Record<string, unknown>;
	errors: unknown[];
	/** Where a report at the warning level goes. */
	warnings: unknown[];
	/** The app of the background. */
	app: TestApp;
	/** Puts a thread's `lynx` in place: it runs before that thread's code does. */
	enter: (thread: Thread) => void;
}): { mainThread: MainThreadLynx; background: BackgroundLynx } {
	const { bridge, lifecycle, errors, warnings, app, enter } = options;
	const mainThread = createSide();
	const background = createSide();

	/** The context through which one thread sends to `to`; `origin` names the sender. */
	function context(own: {
		from: ReturnType<typeof createSide>;
		to: ReturnType<typeof createSide>;
		toThread: Thread;
		origin: string;
	}): ThreadContext {
		return {
			addEventListener(type, listener) {
				if (!own.from.listeners.has(type)) own.from.listeners.set(type, new Set());
				own.from.listeners.get(type)!.add(listener);
			},
			removeEventListener(type, listener) {
				own.from.listeners.get(type)?.delete(listener);
			},
			dispatchEvent({ type, data }) {
				const copy = copyMessage(type, data);
				bridge.send(() => {
					enter(own.toThread);
					own.to.tell({ type, data: copy, origin: own.origin });
				});
			},
		};
	}

	const shared = (): SharedLynx => ({
		__initData: options.initData,
		__globalProps: options.globalProps,
		reportError: (error, reportOptions) =>
			void (reportOptions?.level === "warning" ? warnings : errors).push(error),
	});
	const jsContext = context({
		from: mainThread,
		to: background,
		toThread: "background",
		origin: "CoreContext",
	});
	const coreContext = context({
		from: background,
		to: mainThread,
		toThread: "main-thread",
		origin: "JSContext",
	});
	const nativeApp: NativeApp = {
		callLepusMethod(name, params, callback) {
			const copy = copyMessage(name, params);
			bridge.send(() => {
				enter("main-thread");
				const method = readGlobal(name);
				if (typeof method !== "function") {
					errors.push(
						new Error(
							`callLepusMethod called ${name}, which the main thread does not have. ` +
								"Lynx reports it and calls nothing.",
						),
					);
					return;
				}
				method(copy);
				if (callback) {
					bridge.send(() => {
						enter("background");
						callback();
					});
				}
			});
		},
	};

	return {
		mainThread: {
			...shared(),
			getJSContext: () => jsContext,
			getEngine: () => lifecycle.engine,
			getNative: () => lifecycle.native,
			setTimeout(callback) {
				bridge.send(() => {
					enter("main-thread");
					callback();
				});
			},
		},
		background: {
			...shared(),
			getCoreContext: () => coreContext,
			getNativeApp: () => nativeApp,
			getApp: () => app,
			queueMicrotask: (callback) => queueMicrotaskAs(() => enter("background"), callback),
		},
	};
}
