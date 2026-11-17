// The `lynx` a test page's code reads. On a device each thread has its own; in one process both
// threads read one global, so this one has each thread's part: the main thread's (its way to the
// background, the engine's events) and the background's (its way to the main thread, the native
// app). Everything that goes from one thread to the other crosses the page's bridge.

import type { Lifecycle, LifecycleProxy } from "../engine/lifecycle.ts";
import { readGlobal } from "../globals.ts";
import type { Bridge } from "./bridge.ts";

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
	/** Sends a message to the other thread; its listeners of `type` get it on a later task. */
	dispatchEvent(event: { type: string; data: unknown }): void;
}

/** What `lynx.getNativeApp()` answers on the background. */
export interface NativeApp {
	/**
	 * Calls the main thread's global function `name` with `params` on a later task, then `callback`
	 * on the background on a task after that.
	 */
	callLepusMethod(name: string, params: unknown, callback?: () => void): void;
}

/** The `lynx` of a test page. */
export interface TestLynx {
	/** The page's initial data. */
	readonly __initData: Record<string, unknown>;
	/** The host's global props. */
	readonly __globalProps: Record<string, unknown>;
	/** The main thread's way to the background. */
	getJSContext(): ThreadContext;
	/** The background's way to the main thread. */
	getCoreContext(): ThreadContext;
	/** The engine's events, on the main thread. */
	getEngine(): LifecycleProxy;
	/** The native side's events, on the main thread: the page's end. */
	getNative(): LifecycleProxy;
	/** The native app, on the background. */
	getNativeApp(): NativeApp;
	/** Reports an error into Lynx; the test page keeps it. */
	reportError(error: unknown): void;
}

/** One side's listeners, and the context that sends to the other side's. */
function createSide(): {
	listeners: Map<string, Set<MessageListener>>;
	tell(type: string, event: ThreadMessage): void;
} {
	const listeners = new Map<string, Set<MessageListener>>();
	return {
		listeners,
		tell(type, event) {
			// oxlint-disable-next-line unicorn/no-useless-spread -- copied: a listener may remove itself while it is told
			for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
		},
	};
}

/** Makes the `lynx` of a test page, over its bridge and its engine's lifecycle. */
export function createLynx(options: {
	bridge: Bridge;
	lifecycle: Lifecycle;
	initData: Record<string, unknown>;
	globalProps: Record<string, unknown>;
	errors: unknown[];
}): TestLynx {
	const { bridge, lifecycle, errors } = options;
	const mainThread = createSide();
	const background = createSide();

	/** The context through which `from` sends to `to`; `origin` names `from` to the receiver. */
	function context(
		from: ReturnType<typeof createSide>,
		to: ReturnType<typeof createSide>,
		origin: string,
	): ThreadContext {
		return {
			addEventListener(type, listener) {
				if (!from.listeners.has(type)) from.listeners.set(type, new Set());
				from.listeners.get(type)!.add(listener);
			},
			removeEventListener(type, listener) {
				from.listeners.get(type)?.delete(listener);
			},
			dispatchEvent({ type, data }) {
				bridge.send(() => to.tell(type, { type, data, origin }));
			},
		};
	}

	const jsContext = context(mainThread, background, "CoreContext");
	const coreContext = context(background, mainThread, "JSContext");
	const nativeApp: NativeApp = {
		callLepusMethod(name, params, callback) {
			bridge.send(() => {
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
				method(params);
				if (callback) bridge.send(callback);
			});
		},
	};

	return {
		__initData: options.initData,
		__globalProps: options.globalProps,
		getJSContext: () => jsContext,
		getCoreContext: () => coreContext,
		getEngine: () => lifecycle.engine,
		getNative: () => lifecycle.native,
		getNativeApp: () => nativeApp,
		reportError: (error) => void errors.push(error),
	};
}
