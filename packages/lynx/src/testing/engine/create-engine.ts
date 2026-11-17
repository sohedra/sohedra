// The engine fake: what Lynx's main thread does with the page's elements, on a DOM.

import { nextMacrotask, testDocument } from "../globals.ts";
import { animationFunctions } from "./animations.ts";
import type { AnimationFunctions } from "./animations.ts";
import { createDispatcher } from "./dispatch.ts";
import { eventFunctions } from "./events.ts";
import type { EventFunctions } from "./events.ts";
import { createGestureDriver, gestureFunctions } from "./gestures.ts";
import type { GestureFunctions } from "./gestures.ts";
import { createLifecycle } from "./lifecycle.ts";
import type { Lifecycle } from "./lifecycle.ts";
import { listFunctions, listHandle } from "./lists.ts";
import type { ListFunctions, ListHandle } from "./lists.ts";
import { propertyFunctions } from "./properties.ts";
import type { PropertyFunctions } from "./properties.ts";
import { stateOf } from "./state.ts";
import type {
	AnimationLog,
	BackgroundEventLog,
	BindingLog,
	Detector,
	ElementState,
	EngineState,
	GestureCallLog,
	InvocationLog,
	ManagerCallLog,
	Responder,
	RunLog,
} from "./state.ts";
import { createStyleSheets } from "./style-sheets.ts";
import type { StyleSheetFunctions } from "./style-sheets.ts";
import { descendantsOf, isText, treeFunctions } from "./tree.ts";
import type { TreeFunctions } from "./tree.ts";
import type { LynxElement } from "./types.ts";
import { uiFunctions } from "./ui-methods.ts";
import type { UiFunctions } from "./ui-methods.ts";

/** Lynx's main-thread functions that act on elements. */
export type ElementFunctions = TreeFunctions &
	PropertyFunctions &
	EventFunctions &
	GestureFunctions &
	ListFunctions &
	AnimationFunctions &
	UiFunctions &
	StyleSheetFunctions;

/** Where an engine puts its page. */
export interface EngineOptions {
	/** The document the elements are made in; the test environment's by default. */
	document?: Document;
	/** The element the page goes in; the document's body by default. */
	container?: Element;
	/**
	 * Runs what the engine answers from another thread (a UI method's result) when it comes back;
	 * on a later macrotask by default. A test page passes its own, so that `settle()` waits for it.
	 */
	schedule?: (deliver: () => void) => void;
}

/** One engine: the main thread's element functions and the engine's own side of them. */
export interface Engine {
	/** The functions the page's main thread calls: Lynx installs them as globals. */
	readonly functions: ElementFunctions;
	/** The `<page>` element, once the main thread made it. */
	page(): LynxElement | undefined;
	/** The elements under `root` (the page by default), `root` first, depth first. */
	all(root?: LynxElement): LynxElement[];
	/** The visible text of an element: its raw-text descendants. */
	text(element: LynxElement): string;
	/** The `<text>` elements' contents, in document order. */
	texts(): string[];
	/** What the engine keeps of an element. Read it, don't change it. */
	state(element: LynxElement): ElementState;
	/** Any element made so far, attached or not, by unique id. */
	byUid(uid: number): LynxElement | undefined;
	/** How many elements with this tag were ever made. */
	madeCount(tag: string): number;
	/**
	 * Drops the engine's hold on an element and what is under it. On a device an element that
	 * nothing refers to any more is destroyed; here the registry would keep it for good. For tests
	 * about what the page lets go of once an element is gone.
	 */
	forget(uid: number): void;
	/** Takes the page out of the document and lets go of every element. */
	dispose(): void;

	/**
	 * Fires an event the way Lynx does a custom event (`scroll`, `load`): the global phase, then this
	 * element's own bindings, with no capture and no bubble. Throws when nothing hears it.
	 */
	fire(element: LynxElement, name: string, event?: Record<string, unknown>): void;
	/**
	 * Delivers an event the way Lynx does a touch event (`tap`) along the tree: the global phase,
	 * capture from the page down, the target, bubble up, catch and the stop bits a main-thread
	 * function returns.
	 */
	dispatch(element: LynxElement, name: string, event?: Record<string, unknown>): void;
	/** Every listener still registered anywhere in the page. */
	listenerCount(): number;
	/**
	 * Runs the callback `name` of the element's gesture detector `id`, as Lynx does, with the
	 * gesture's event and the gesture manager. Returns what the function returned.
	 */
	fireGesture(
		element: LynxElement,
		id: number,
		name: string,
		params?: Record<string, unknown>,
	): unknown;
	/** An element's detectors, in the order they were set. */
	detectors(element: LynxElement): Detector[];
	/** What a `<list>` was given, what it was sent, and a way to show and hide its cells. */
	list(element: LynxElement): ListHandle;
	/** The animation `name` of the element ended: the engine says so to a listener, if any. */
	endAnimation(element: LynxElement, name: string): boolean;
	/** The engine cancelled the animation (a new one took its name, say), as it says. */
	cancelAnimation(element: LynxElement, name: string): boolean;
	/** Decides what the page's UI methods get back. The default answers success with no data. */
	respondWith(responder: Responder): void;
	/** Flattens plain views as Lynx does (see `flatten` in the engine's functions); `false` ends it. */
	flattenViews(on?: boolean): void;
	/** The style sheet `__LoadStyleSheet` finds for a bundle. */
	provideStyleSheet(bundleName: string, sheet: unknown): void;
	/** The style sheets the page adopted, in order. */
	readonly adoptedStyleSheets: unknown[];
	/** The engine's lifecycle events: what the page listens to, and what a test makes it say. */
	readonly lifecycle: Lifecycle;

	/** The options of each `__FlushElementTree`. */
	readonly flushes: unknown[];
	/** Every `__InvokeUIMethod` call, with what it answered. */
	readonly invocations: InvocationLog[];
	/** Every `__ElementAnimate` call. */
	readonly animations: AnimationLog[];
	/** Every `__AddEvent` call with a main-thread function, or none (which removes it). */
	readonly workletEvents: BindingLog[];
	/** Every `__AddEvent` call with a handler name, or none: the type filed for an element's event. */
	readonly filings: BindingLog[];
	/** Every `__SetGestureDetector` and `__RemoveGestureDetector` call. */
	readonly gestureCalls: GestureCallLog[];
	/** Every main-thread function the engine ran, and the `eventReturnResult` it read. */
	readonly mainThreadRuns: RunLog[];
	/** Every event the engine sent to a handler name, for the background. */
	readonly backgroundEvents: BackgroundEventLog[];
	/** Every call a gesture callback made on the gesture manager. */
	readonly gestureManagerCalls: ManagerCallLog[];
}

/** Makes an engine. It needs a DOM: the test environment's, or the one given. */
export function createEngine(options: EngineOptions = {}): Engine {
	const document = options.document ?? testDocument();
	const engine: EngineState = {
		document,
		container: options.container ?? document.body,
		nextUid: 1,
		nextBinding: 1,
		page: undefined,
		states: new WeakMap(),
		made: new Map(),
		unflushed: new Set(),
		stale: new Set(),
		flattening: false,
		respond: () => ({ code: 0 }),
		schedule: options.schedule ?? nextMacrotask,
		log: {
			flushes: [],
			invocations: [],
			animations: [],
			workletEvents: [],
			filings: [],
			gestureCalls: [],
			mainThreadRuns: [],
			backgroundEvents: [],
			gestureManagerCalls: [],
		},
	};
	const dispatcher = createDispatcher(engine);
	const gestures = createGestureDriver(engine);
	const styleSheets = createStyleSheets();
	const lifecycle = createLifecycle();
	const functions: ElementFunctions = {
		...treeFunctions(engine),
		...propertyFunctions(engine),
		...eventFunctions(engine),
		...gestureFunctions(engine),
		...listFunctions(engine),
		...animationFunctions(engine, dispatcher),
		...uiFunctions(engine),
		...styleSheets.functions,
	};

	function text(element: LynxElement): string {
		return isText(element)
			? (element.textContent ?? "")
			: [...element.childNodes].map((child) => text(child as LynxElement)).join("");
	}

	return {
		functions,
		page: () => engine.page,
		all: (root = engine.page) => (root ? descendantsOf(root) : []),
		text,
		texts() {
			return engine.page
				? descendantsOf(engine.page)
						.filter((element) => engine.states.get(element)?.tag === "text")
						.map(text)
				: [];
		},
		state: (element) => stateOf(engine, element, "state", 0),
		byUid: (uid) => engine.made.get(uid)?.node,
		madeCount: (tag) => [...engine.made.values()].filter((state) => state.tag === tag).length,
		forget(uid) {
			const root = engine.made.get(uid);
			if (!root) return;
			const gone = new Set<LynxElement>(descendantsOf(root.node));
			for (const element of gone) {
				const state = engine.states.get(element);
				if (state) engine.made.delete(state.uid);
			}
			// The logs would keep what the page let go of, and so would a test.
			for (const log of [
				engine.log.animations,
				engine.log.workletEvents,
				engine.log.filings,
				engine.log.gestureCalls,
				engine.log.mainThreadRuns,
				engine.log.backgroundEvents,
				engine.log.gestureManagerCalls,
				engine.log.invocations,
			] as { element: LynxElement }[][]) {
				const kept = log.filter((entry) => !gone.has(entry.element));
				log.length = 0;
				log.push(...kept);
			}
		},
		dispose() {
			engine.page?.parentNode?.removeChild(engine.page);
			engine.page = undefined;
			engine.made.clear();
			engine.unflushed.clear();
			engine.stale.clear();
		},
		fire: dispatcher.fire,
		dispatch: dispatcher.dispatch,
		listenerCount: () =>
			engine.page
				? descendantsOf(engine.page).reduce(
						(count, element) => count + (engine.states.get(element)?.listeners.length ?? 0),
						0,
					)
				: 0,
		fireGesture: gestures.fireGesture,
		detectors: gestures.detectors,
		list: (element) => listHandle(engine, element),
		endAnimation: (element, name) =>
			dispatcher.animationEvent(stateOf(engine, element, "endAnimation", 0), "animationend", name),
		cancelAnimation: (element, name) =>
			dispatcher.animationEvent(
				stateOf(engine, element, "cancelAnimation", 0),
				"animationcancel",
				name,
			),
		respondWith(responder) {
			engine.respond = responder;
		},
		flattenViews(on = true) {
			engine.flattening = on;
		},
		provideStyleSheet: styleSheets.sheets.provide,
		adoptedStyleSheets: styleSheets.sheets.adopted,
		lifecycle,
		flushes: engine.log.flushes,
		invocations: engine.log.invocations,
		animations: engine.log.animations,
		workletEvents: engine.log.workletEvents,
		filings: engine.log.filings,
		gestureCalls: engine.log.gestureCalls,
		mainThreadRuns: engine.log.mainThreadRuns,
		backgroundEvents: engine.log.backgroundEvents,
		gestureManagerCalls: engine.log.gestureManagerCalls,
	};
}
