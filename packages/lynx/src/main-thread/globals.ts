// The globals of Lynx's main thread, as this folder's code may use them. Add a member when code
// first uses it, after checking it on the engine.

import { FUNCTIONS_GLOBAL, REGISTER_FUNCTION } from "../wire/index.ts";
import type { FunctionsGlobal } from "../wire/index.ts";

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

/**
 * Lynx asks a list for the cell at an index: the callback answers the cell's unique id, or -1. On
 * Lynx's async list (`custom-list-name="list-container"`) it may answer later: it returns
 * `undefined`, which the engine reads as no answer (0), and flushes the cell with `operationId`
 * when it is made.
 */
export type ComponentAtIndex = (
	list: LynxElement,
	listId: number,
	index: number,
	operationId: number,
	enableReuseNotification?: boolean,
) => number | undefined;

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

/**
 * What the main thread's engine provides: Lynx's element functions, and a smaller `lynx`. The test
 * library's engine fake is checked against it (tests/types/globals/fakes.ts).
 */
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
		/**
		 * Runs `callback` on a later task of the main thread, `delay` milliseconds from now, and
		 * answers the timer's number (core/runtime/lepus/bindings/renderer_functions.cc, SetTimeout).
		 */
		setTimeout(callback: () => void, delay: number): number;
		/** Cancels a timer by the number `setTimeout` answered (ClearTimeout). */
		clearTimeout(timer: number): void;
		/**
		 * A bundle the engine has fetched or is fetching: `wait` answers once it is there, or once
		 * `seconds` have passed (core/runtime/lepus/bindings/renderer_functions.cc, FetchBundle).
		 */
		fetchBundle(
			url: string,
			options: Record<string, never>,
		): { wait(seconds: number): { code: number; url: string } | undefined };
		/** Runs a section of a fetched bundle and answers what it returns (LoadScript). */
		loadScript(section: string, options: { bundleName: string }): unknown;
		/** What the bundler's chunk loader calls for an `import()` the build made a lazy bundle. */
		loadLazyBundle?: (url: string) => Promise<unknown>;
	};
	/** A style sheet section of a fetched bundle, or nothing (LoadStyleSheet). */
	__LoadStyleSheet(section: string, bundleName: string): unknown;
	/** Applies a style sheet `__LoadStyleSheet` answered to the page (AdoptStyleSheet). */
	__AdoptStyleSheet(sheet: unknown): void;
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
	/**
	 * Binds a main-thread function to an element's event, or with none, unbinds it
	 * (core/runtime/lepus/bindings/renderer_functions.cc, FiberAddEvent). The engine hands `value`
	 * back to the global `runWorklet` on each event.
	 */
	__AddEvent(
		element: LynxElement,
		type: string,
		name: string,
		value: { type: "worklet"; value: unknown } | undefined,
	): void;
	/**
	 * Sets the element's gesture detector `id`, replacing one it had under that id
	 * (renderer_functions.cc, FiberSetGestureDetector). The engine hands each callback's value back
	 * to the global `runWorklet`, with the gesture's event and its gesture manager.
	 */
	__SetGestureDetector(
		element: LynxElement,
		id: number,
		type: number,
		callbacks: { callbacks: { name: string; callback: unknown }[]; config: unknown },
		relations: { waitFor: number[]; simultaneous: number[]; continueWith: number[] },
	): void;
	/** Removes the element's gesture detector `id` (renderer_functions.cc, FiberRemoveGestureDetector). */
	__RemoveGestureDetector(element: LynxElement, id: number): void;
	/** The element's parent, or none (renderer_functions.cc, FiberGetParent). */
	__GetParent(element: LynxElement): LynxElement | undefined | null;
	/** The element's `id` (renderer_functions.cc, FiberGetID). */
	__GetID(element: LynxElement): string | undefined;
	/** A copy of the element's dataset (renderer_functions.cc, FiberGetDataset). */
	__GetDataset(element: LynxElement): Record<string, unknown> | undefined;
	__GetAttributeByName(element: LynxElement, name: string): unknown;
	__GetAttributeNames(element: LynxElement): string[];
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
	/** The standard one, on an engine that has it: the main thread tells the background what it let go of. */
	FinalizationRegistry?: typeof FinalizationRegistry;
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
declare const __FIRST_FRAME__: boolean | undefined;

/** `true` in a development build: the build replaces it, and drops what it guards otherwise. */
export const DEV: boolean = __DEV__;

/**
 * `false` in a build where no page draws its first frame, which then drops the drawing of the
 * first frame and its hydration from the runtime. A test run leaves it unset, and draws.
 */
export const DRAWS: boolean = typeof __FIRST_FRAME__ === "undefined" || __FIRST_FRAME__;

/** A chunk of the bundler's: its modules, by id. */
export interface BundlerChunk {
	modules?: Record<string, unknown>;
}

/** The bundler's runtime: it runs a module by id, and `C` installs a chunk's modules. */
type BundlerRequire = ((id: string) => unknown) & { C?: (chunk: BundlerChunk) => void };

// The bundler names its own runtime so in the modules it bundles.
declare const __webpack_require__: BundlerRequire | undefined;

/** The bundler's runtime of the main thread's script. */
export function bundlerRequire(): BundlerRequire | undefined {
	return typeof __webpack_require__ === "undefined" ? undefined : __webpack_require__;
}

/** The value of a global the page's own script set, by name. */
export function readGlobal(name: string): unknown {
	return globalScope[name];
}

/**
 * What the main thread keeps for main-thread functions, shared with the page's own code: they are
 * separate roots of the main thread's script, and meet only on the global object. Made by whichever
 * loads first.
 */
export function functionsGlobal(): FunctionsGlobal {
	// Boundary: the one object of this name, made here or by the page's code, of this shape.
	return (globalScope[FUNCTIONS_GLOBAL] ??= {
		bodies: {},
		nextFirstFrameRef: -1,
	} satisfies FunctionsGlobal) as FunctionsGlobal;
}

/** Puts the function compiled code registers each main-thread function's body with, once. */
export function installRegistry(): void {
	globalScope[REGISTER_FUNCTION] ??= (
		_kind: string,
		id: string,
		body: FunctionsGlobal["bodies"][string],
	) => {
		functionsGlobal().bodies[id] = body;
	};
}
