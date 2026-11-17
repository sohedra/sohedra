// The globals of Lynx's main thread, as this folder's code may use them. Add a member when code
// first uses it, after checking it on the engine.

/** A Lynx element, as the element functions take and give it. */
export type LynxElement = object;

/** A message event of the engine, as `lynx.getEngine()` and `lynx.getNative()` send it. */
export interface EngineMessage {
	type: string;
	data: unknown;
}

/** A context that sends the main thread events: `lynx.getEngine()`, `lynx.getNative()`. */
export interface EventSource {
	addEventListener(type: string, listener: (event: EngineMessage) => void): void;
	removeEventListener(type: string, listener: (event: EngineMessage) => void): void;
}

/**
 * The options of `__AddEventListener`. With `closure_type: 2`, the engine reads `bind_type` alone
 * for the phase and the catch (core/runtime/lepus/bindings/renderer_functions.cc,
 * FiberAddEventListener).
 */
export interface ListenerOptions {
	closure_type: number;
	bind_type: number;
}

/** What `__InvokeUIMethod` answers: `code` 0 is success. */
export interface InvokeResult {
	code: number;
	data?: unknown;
}

/** Lynx asks a list for the cell at an index: the callback answers the cell's unique id, or -1. */
export type ComponentAtIndex = (
	list: LynxElement,
	listId: number,
	index: number,
	operationId: number,
	enableReuseNotification?: boolean,
) => number;

/** Lynx asks a list for several cells at once. */
export type ComponentAtIndexes = (
	list: LynxElement,
	listId: number,
	indexes: number[],
	operationIds: number[],
	enableReuseNotification?: boolean,
	asyncFlush?: boolean,
) => void;

/** Lynx hands a cell back, by its unique id. */
export type EnqueueComponent = (list: LynxElement, listId: number, sign: number) => void;

/** What the main thread's engine provides: Lynx's element functions, and a smaller `lynx`. */
export interface MainThreadGlobals {
	lynx: {
		reportError(error: unknown): void;
		/** The main thread's way to the background. */
		getJSContext(): { dispatchEvent(event: { type: string; data: string }): void };
		/** The engine's events: render and update the page. */
		getEngine(): EventSource;
		/** The native side's events: the end of the page's life. */
		getNative(): EventSource;
		/** The platform, the screen and the engine's version, which the background has as a global. */
		SystemInfo?: unknown;
	};
	__CreatePage(componentId: string, cssId: number): LynxElement;
	__GetElementUniqueID(element: LynxElement): number;
	__CreateView(parentComponentUniqueId: number): LynxElement;
	__CreateText(parentComponentUniqueId: number): LynxElement;
	__CreateImage(parentComponentUniqueId: number): LynxElement;
	__CreateScrollView(parentComponentUniqueId: number): LynxElement;
	__CreateElement(tag: string, parentComponentUniqueId: number): LynxElement;
	/** core/runtime/lepus/bindings/renderer_functions.cc, FiberCreateList. */
	__CreateList(
		parentComponentUniqueId: number,
		componentAtIndex: ComponentAtIndex,
		enqueueComponent: EnqueueComponent,
		info: Record<string, unknown>,
		componentAtIndexes: ComponentAtIndexes,
	): LynxElement;
	/** FiberUpdateListCallbacks: `null` lets go of the page's callbacks. */
	__UpdateListCallbacks(
		list: LynxElement,
		componentAtIndex: ComponentAtIndex | null,
		enqueueComponent: EnqueueComponent | null,
		componentAtIndexes: ComponentAtIndexes | null,
	): void;
	__AppendElement(parent: LynxElement, child: LynxElement): void;
	__InsertElementBefore(parent: LynxElement, child: LynxElement, reference: LynxElement): void;
	__RemoveElement(parent: LynxElement, child: LynxElement): void;
	__SetAttribute(element: LynxElement, key: string, value: unknown): void;
	__SetClasses(element: LynxElement, classes: string): void;
	__SetInlineStyles(element: LynxElement, styles: string | Record<string, string>): void;
	__AddInlineStyle(element: LynxElement, name: string, value: string | number | null): void;
	__GetComputedStyleByKey(element: LynxElement, name: string): string;
	__QuerySelector(
		element: LynxElement,
		selector: string,
		options: Record<string, unknown>,
	): LynxElement | undefined | null;
	__QuerySelectorAll(
		element: LynxElement,
		selector: string,
		options: Record<string, unknown>,
	): LynxElement[];
	/** core/renderer/dom/element.cc, Element::AnimateV2: `[operation, name, keyframes, options]`. */
	__ElementAnimate(element: LynxElement, args: unknown[]): void;
	__SetID(element: LynxElement, id: string | null): void;
	__SetDataset(element: LynxElement, dataset: Record<string, unknown>): void;
	__AddEventListener(
		element: LynxElement,
		name: string,
		listener: (event: unknown) => void,
		options: ListenerOptions,
	): void;
	__RemoveEventListener(
		element: LynxElement,
		name: string,
		listener: (event: unknown) => void,
		options: ListenerOptions,
	): void;
	__InvokeUIMethod(
		element: LynxElement,
		method: string,
		params: Record<string, unknown>,
		callback: (result: InvokeResult) => void,
	): void;
	__FlushElementTree(page?: LynxElement, options?: Record<string, unknown>): void;
	__GetPageElement(): unknown;
	/**
	 * Runs `callback` at the platform's next frame (core/runtime/lepus/bindings/renderer_functions.cc,
	 * RequestAnimationFrame).
	 */
	requestAnimationFrame(callback: () => void): number;
	/**
	 * Reports an error into Lynx with its code and level
	 * (core/runtime/lepus/bindings/renderer_functions.cc, ReportError); `undefined` on an engine
	 * without it.
	 */
	_ReportError?: (error: Error, options: { errorCode: number }) => void;
}

// Boundary: the engine's globals have no types; this is the one place `globalThis` is typed.
export const mainThread: MainThreadGlobals = globalThis as unknown as MainThreadGlobals;

/** A global object, its values by name. */
type Scope = Record<string, unknown>;

// Boundary: the engine finds what is put there by name.
/** The main thread's global object, where start-up fills in what the engine lacks. */
export const globalScope: Scope = globalThis as unknown as Scope;

/** Puts a function the engine or the background calls by name on the main thread's globals. */
export function setGlobalFunction(name: string, fn: (...args: never[]) => unknown): void {
	globalScope[name] = fn;
}

declare const __DEV__: boolean;

/** `true` in a development build: the build replaces it, and drops what it guards otherwise. */
export const DEV: boolean = __DEV__;

/** The value of a global the page's own script set, by name. */
export function readGlobal(name: string): unknown {
	return globalScope[name];
}
