// The engine's lifecycle events, as the main thread hears them. The engine tells the page to
// render, update and remove its components through `lynx.getEngine()`, or, when nothing listens
// there, by calling the main thread's global function of that name
// (core/renderer/template_assembler.h, DispatchEventFromEngineToCoreContext). It ends the page's
// life through `lynx.getNative()`, with the page's instance id (core/shell/lynx_shell.cc). A
// listener gets a message event: its type, its data and where it comes from
// (core/runtime/lepus/bindings/event/lepus_event_listener.cc, ConvertEventToLepusValue).

import { readGlobal } from "../globals.ts";

/** What a listener of an engine event gets. */
export interface LifecycleEvent {
	type: string;
	data: unknown;
	/** The context that sent it: `Engine` or `Native`. */
	origin: string;
}

type LifecycleListener = (event: LifecycleEvent) => void;

/** What the page sees of a context that sends it events: `lynx.getEngine()`, `lynx.getNative()`. */
export interface LifecycleProxy {
	addEventListener(type: string, listener: LifecycleListener): void;
	removeEventListener(type: string, listener: LifecycleListener): void;
}

/** The engine's lifecycle: what the page listens to, and what a test makes the engine say. */
export interface Lifecycle {
	/** What `lynx.getEngine()` answers. */
	readonly engine: LifecycleProxy;
	/** What `lynx.getNative()` answers. */
	readonly native: LifecycleProxy;
	/** How many listeners an event type has on `lynx.getEngine()`. */
	count(type: string): number;
	/** The engine renders the page, with its initial data. */
	render(data?: Record<string, unknown>, options?: Record<string, unknown>): void;
	/** The engine updates the page's data. */
	update(data: Record<string, unknown>, options?: Record<string, unknown>): void;
	/** The engine sends new global props. */
	updateGlobalProps(data: Record<string, unknown>): void;
	/** The engine removes the page's components. */
	removeComponents(): void;
	/** The engine ends the page's life. */
	destroy(instanceId?: number): void;
	/** The engine sends any event type through `lynx.getEngine()`. */
	emit(type: string, data?: unknown[]): void;
}

/** A context that sends events, and the listeners the page added to it. */
function createProxy(origin: string): {
	proxy: LifecycleProxy;
	count(type: string): number;
	send(type: string, data: unknown): void;
} {
	const listeners = new Map<string, Set<LifecycleListener>>();
	return {
		proxy: {
			addEventListener(type, listener) {
				if (!listeners.has(type)) listeners.set(type, new Set());
				listeners.get(type)!.add(listener);
			},
			removeEventListener(type, listener) {
				listeners.get(type)?.delete(listener);
			},
		},
		count: (type) => listeners.get(type)?.size ?? 0,
		send(type, data) {
			// oxlint-disable-next-line unicorn/no-useless-spread -- copied: a listener may remove itself while it is told
			for (const listener of [...(listeners.get(type) ?? [])]) listener({ type, data, origin });
		},
	};
}

/** Makes the engine's lifecycle. */
export function createLifecycle(page: {
	/** Runs before the engine calls the page's main-thread code. */
	enter: () => void;
	/** Where the engine reports what Lynx reports and carries on from. */
	report: (error: Error) => void;
}): Lifecycle {
	const engine = createProxy("Engine");
	const native = createProxy("Native");

	/**
	 * An event through `lynx.getEngine()`, or a call of the global `fallback` when none listens. The
	 * engine calls it, not tries it (`try_call` is false), so a missing one is reported.
	 */
	function toPage(type: string, fallback: string, args: unknown[]): void {
		page.enter();
		if (engine.count(type) > 0) {
			engine.send(type, args);
			return;
		}
		const call = readGlobal(fallback);
		if (typeof call === "function") {
			call(...args);
			return;
		}
		page.report(
			new Error(
				`The engine sent ${type}, and the main thread has no ${fallback} function and nothing ` +
					`listening for ${type} on lynx.getEngine(). Lynx reports the missing function.`,
			),
		);
	}

	return {
		engine: engine.proxy,
		native: native.proxy,
		count: engine.count,
		render: (data = {}, options = {}) => toPage("__RenderPage", "renderPage", [data, options]),
		update: (data, options = {}) => toPage("__UpdatePage", "updatePage", [data, options]),
		updateGlobalProps: (data) => toPage("__UpdateGlobalProps", "updateGlobalProps", [data]),
		removeComponents: () => toPage("__RemoveComponents", "removeComponents", []),
		destroy(instanceId = 0) {
			page.enter();
			native.send("__DestroyLifetime", instanceId);
		},
		emit(type, data = []) {
			page.enter();
			engine.send(type, data);
		},
	};
}
