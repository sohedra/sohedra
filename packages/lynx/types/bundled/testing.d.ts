// `@sohedra/lynx/testing`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

export * from "@testing-library/dom";

import type { HostEvents } from "@sohedra/lynx/host";
import type { BoundFunctions, queries } from "@testing-library/dom";
import type { Component } from "svelte";
/** Ends the page that is running, if any: its elements leave the document and its globals go. */
export function cleanup(): void;
/**
 * Runs `change`, if any, with the background's globals in place, then waits until both threads are
 * idle, and fails with what the page reported meanwhile. Resolves with what `change` returned. The
 * task the test is in ends first: an event the test did not wait for finishes on its thread.
 */
export function act<T>(change?: () => T | Promise<T>): Promise<T | undefined>;
/** The init of a Lynx event in `fireEvent`: `bubbles`, `detail`, and any other field the event has. */
export interface LynxEventInit {
	/** Whether the event travels as a touch does: captured, then bubbling. The touch family does. */
	bubbles?: boolean;
	/** The event's `detail`. */
	detail?: unknown;
	[field: string]: unknown;
}
declare const EVENTS: {
	readonly tap: true;
	readonly longtap: true;
	readonly longpress: true;
	readonly touchstart: true;
	readonly touchmove: true;
	readonly touchcancel: true;
	readonly touchend: true;
	readonly bgload: false;
	readonly bgerror: false;
	readonly load: false;
	readonly error: false;
	readonly transitionstart: false;
	readonly transitioncancel: false;
	readonly transitionend: false;
	readonly animationstart: false;
	readonly animationiteration: false;
	readonly animationcancel: false;
	readonly animationend: false;
	readonly mousedown: false;
	readonly mouseup: false;
	readonly mousemove: false;
	readonly mouseclick: false;
	readonly mousedblclick: false;
	readonly mouselongpress: false;
	readonly wheel: false;
	readonly keydown: false;
	readonly keyup: false;
	readonly focus: false;
	readonly blur: false;
	readonly input: false;
	readonly confirm: false;
	readonly selection: false;
	readonly layoutchange: false;
	readonly scrolltoupper: false;
	readonly scrolltolower: false;
	readonly scroll: false;
	readonly scrollend: false;
	readonly contentsizechanged: false;
	readonly scrolltoupperedge: false;
	readonly scrolltoloweredge: false;
	readonly scrolltonormalstate: false;
};
/** The names of the Lynx events `fireEvent` has a shortcut for (`fireEvent.tap`). */
export type LynxEventName = keyof typeof EVENTS;
/** `fireEvent` and its shortcuts. */
export type FireEvent = {
	/**
	 * Fires the Lynx event `event` with `init` on `element`, or a DOM event as the Lynx event it
	 * stands for (its type, its own fields, and a `CustomEvent`'s `detail`), then waits until both
	 * threads are idle. A DOM event bubbles as it was made: `new Event("tap")` does not, and reaches
	 * its element only. Resolves with `true`: a Lynx event cannot be canceled.
	 */
	(element: Element, event: Event | string, init?: LynxEventInit): Promise<boolean>;
} & {
	[Name in LynxEventName]: (element: Element, init?: LynxEventInit) => Promise<boolean>;
};
/**
 * Fires a Lynx event on an element of the page, then waits until both threads are idle. Each name
 * in `LynxEventName` is also a function: `fireEvent.tap(element)`.
 */
export const fireEvent: FireEvent;
/** What the page's Lynx starts with. */
export interface LynxRenderOptions {
	/** The data the host opens the page with: `initData` of `@sohedra/lynx/host`. */
	initData?: Record<string, unknown>;
	/** The host's global props: `globalProps` of `@sohedra/lynx/host`. */
	globalProps?: Record<string, unknown>;
	/** What Lynx says about the device, over an iPhone's: `systemInfo` of `@sohedra/lynx/host`. */
	systemInfo?: Record<string, unknown>;
	/**
	 * Draw the first frame from the component's first-frame copy, which the background then
	 * hydrates, as a device does. Turn it on to test what the first frame shows, or that the first
	 * frame and the background agree (hydration). Off, the background draws the page alone, which is
	 * what most tests of a component's behavior need. The test presets give each component its copy
	 * either way, since a copy also brings the component's main-thread functions to the main thread;
	 * with the plugin's `firstFrame: false`, components have none, and this cannot be on.
	 * @defaultValue false, as ReactLynx's `render` leaves the main thread's render off
	 */
	firstFrame?: boolean;
	/**
	 * Start the background. With `false` the page is the first frame alone, for a test of what the
	 * first frame draws: what needs the background says so instead of waiting.
	 * @defaultValue true
	 */
	background?: boolean;
}
/** The options of `render`. */
export interface RenderOptions<Props extends Record<string, unknown>> {
	/** The component's props; `rerender` changes them. */
	props?: Props;
	/** The contexts the component gets, as Svelte's `mount` takes them. */
	context?: Map<any, any>;
	/** What the page's Lynx starts with. */
	lynx?: LynxRenderOptions;
}
/** What `render` resolves with: the page, the component's exports, the bound queries and Lynx. */
export type RenderResult<
	Exports extends Record<string, unknown>,
	Props extends Record<string, unknown>,
> = {
	/** The page: Lynx's `<page>` element, with the component's elements under it. */
	container: LynxTestElement;
	/** `document.body`, which holds the page, and which `screen` queries. */
	baseElement: HTMLElement;
	/** The component's exports, on the background. */
	component: Exports;
	/**
	 * Changes the props, as a parent would; resolves once the change is on the page. An event the
	 * test did not wait for finishes on its thread first.
	 */
	rerender(props: Partial<Props>): Promise<void>;
	/** Ends the page, as Lynx destroys it; `cleanup` does it too. */
	unmount(): Promise<void>;
	/** Prints the page, or `element`. */
	debug(element?: Element): void;
	/** The Lynx around the page. */
	lynx: TestLynx;
} & BoundFunctions<typeof queries>;
/**
 * Renders `Component` as a Lynx page, on both threads. One page at a time, as in a Lynx view:
 * `cleanup()`, which the test presets run after each test, ends it.
 */
export function render<
	Props extends Record<string, unknown>,
	Exports extends Record<string, unknown> = Record<string, never>,
>(
	Component: Component<Props, Exports, string>,
	options?: RenderOptions<Props>,
): Promise<RenderResult<Exports, Props>>;
/** A Lynx element in a test: a DOM element (`<view>`, `<text>`) in `document.body`. */
export type LynxTestElement = HTMLElement;
/** A UI method call (`node.invoke()`) the page made. */
export interface Invocation {
	element: LynxTestElement;
	method: string;
	params: Record<string, unknown>;
}
/** Answers the page's UI method calls: what Lynx would answer `invoke` with. */
export type InvokeHandler = (call: Invocation) => InvokeResult;
/** An element's box, as `boundingClientRect` gives it, in Lynx's layout units. */
export interface TestRect {
	left: number;
	top: number;
	width: number;
	height: number;
}
/**
 * The kinds of gesture an element may have, named after their classes: `"pan"` is a `PanGesture`,
 * `"defaultScroll"` a `DefaultScrollGesture`.
 */
export type TestGestureKind = "pan" | "tap" | "fling" | "longPress" | "defaultScroll" | "native";
/** What a gesture's callback gets besides the gesture manager: its values and when it happened. */
export interface TestGestureEvent {
	/** The gesture's values (`x`, `y`, `pageX`, `velocityX`), as the event's `params`. */
	params?: Record<string, unknown>;
	/** When it happened, in milliseconds: now by default. */
	timestamp?: number;
}
/** A gesture of an element, as Lynx drives it. */
export interface TestGesture {
	/**
	 * Runs the gesture's callback `name` (`onBegin`, `onUpdate`, `onEnd`) on the main thread, as Lynx
	 * does when the gesture moves, then waits until both threads are idle.
	 */
	fire(name: string, event?: TestGestureEvent): Promise<void>;
}
/** A native `<list>`, as Lynx asks it for its cells while it scrolls. */
export interface TestList {
	/** Lynx shows the cell at `index`; returns its `<list-item>`. */
	show(index: number): LynxTestElement;
	/** Lynx hands a shown cell back, with its `<list-item>`: it scrolled away. */
	hide(item: LynxTestElement): void;
}
/** The Lynx around the page: what a test drives, or answers, in Lynx's place. */
export interface TestLynx {
	/** Answers `invoke` (an element's UI methods); by default every call succeeds with no data. */
	respondInvoke(handler: InvokeHandler): void;
	/** Every UI method call so far. */
	readonly invocations: readonly Invocation[];
	/**
	 * Gives `element` a box: its `boundingClientRect` answers it from now on, whatever
	 * `respondInvoke` answers.
	 */
	setBoundingClientRect(element: Element, rect: TestRect): void;
	/** A native `<list>`, to show and hide its cells as Lynx does while it scrolls. */
	list(element: Element): TestList;
	/** The gesture of an element; `kind` names which, when it has several. */
	gesture(element: Element, kind?: TestGestureKind): TestGesture;
	/** The host changes its global props, merged into those it has. */
	updateGlobalProps(props: Record<string, unknown>): Promise<void>;
	/** The host sends the page new data, merged into its data. */
	updateInitData(data: Record<string, unknown>): Promise<void>;
	/**
	 * The host sends one of its events, with its arguments: what `on(host, name, …)` hears. An event
	 * `HostEvents` names takes its arguments.
	 */
	sendHostEvent<Name extends string>(
		name: Name,
		...args: Name extends keyof HostEvents ? [args: HostEvents[Name]] : [args?: readonly unknown[]]
	): Promise<void>;
	/** The host reloads the page, with data to add to its data. */
	reload(data?: Record<string, unknown>): Promise<void>;
}
/** What a UI method answers: `code` 0 is success, 6 is "this element has no UI yet". */
export interface InvokeResult {
	code: number;
	data?: unknown;
}

export {};
