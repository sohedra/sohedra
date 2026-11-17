// The engine's lifecycle events, as `lynx.getEngine()` hands them to the page: the engine tells
// the main thread when to render, update and end (core/runtime/js/runtime_constant.h).

/** What a listener of an engine event gets. */
export interface LifecycleEvent {
	data: unknown[];
}

type LifecycleListener = (event: LifecycleEvent) => void;

/** What the page sees: `lynx.getEngine()`. */
export interface LifecycleProxy {
	addEventListener(type: string, listener: LifecycleListener): void;
	removeEventListener(type: string, listener: LifecycleListener): void;
}

/** The engine's lifecycle: what the page listens to, and what a test makes the engine say. */
export interface Lifecycle {
	/** What `lynx.getEngine()` answers. */
	readonly proxy: LifecycleProxy;
	/** How many listeners an event type has. */
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
	destroy(appGuid?: number): void;
	/** The engine sends any event type. */
	emit(type: string, data?: unknown[]): void;
}

/** Makes the engine's lifecycle. */
export function createLifecycle(): Lifecycle {
	const listeners = new Map<string, Set<LifecycleListener>>();
	function emit(type: string, data: unknown[] = []): void {
		// oxlint-disable-next-line unicorn/no-useless-spread -- copied: a listener may remove itself while it is told
		for (const listener of [...(listeners.get(type) ?? [])]) listener({ data });
	}
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
		render: (data = {}, options = {}) => emit("__RenderPage", [data, options]),
		update: (data, options = {}) => emit("__UpdatePage", [data, options]),
		updateGlobalProps: (data) => emit("__UpdateGlobalProps", [data]),
		removeComponents: () => emit("__RemoveComponents"),
		destroy: (appGuid = 0) => emit("__DestroyLifetime", [appGuid]),
		emit,
	};
}
