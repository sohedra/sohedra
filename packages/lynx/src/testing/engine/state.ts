// What the engine keeps: a record for each element it made, and the logs of what the page asked.

import type {
	ComponentAtIndex,
	ComponentAtIndexes,
	EnqueueComponent,
	InvokeResult,
	LynxElement,
	ListenerFunction,
	ListenerOptions,
	ListUpdate,
} from "./types.ts";

/** A listener added with `__AddEventListener`. */
export interface RegisteredListener {
	name: string;
	listener: ListenerFunction;
	options: ListenerOptions;
}

/** A main-thread function bound to an element's event with `__AddEvent`. */
export interface BoundFunction {
	/** `bindEvent`, `catchEvent`, `capture-bind`, `capture-catch` or `global-bindEvent`. */
	eventType: string;
	eventName: string;
	/** The function as the engine holds it: opaque, handed to the global `runWorklet`. */
	value: unknown;
}

/** A gesture detector set with `__SetGestureDetector`. */
export interface Detector {
	/** The id Lynx knows it by: the one `__SetGestureDetector` was given. */
	id: number;
	type: number;
	callbacks: { name: string; callback: unknown }[];
	config: unknown;
	relations: unknown;
	/** The last state a callback set through the gesture manager: 1 active, 2 fail, 3 end. */
	state?: number;
	/** The last `__ConsumeGesture` params a callback passed for it. */
	consume?: unknown;
}

/** An animation started with `__ElementAnimate`, until it is cancelled. */
export interface RunningAnimation {
	keyframes: unknown;
	options: unknown;
	state: "running" | "paused";
}

/** What a `<list>` keeps: the callbacks Lynx would call, and every update it got. */
export interface ListState {
	componentAtIndex: ComponentAtIndex;
	componentAtIndexes: ComponentAtIndexes | undefined;
	enqueueComponent: EnqueueComponent;
	updates: ListUpdate[];
	/** Called inside each update, as iOS asks for cells right away. */
	onUpdate?: (update: ListUpdate) => void;
	/** The number of the last cell request: Lynx numbers them. */
	operations: number;
}

/** What the engine keeps of an element, besides the DOM node that shows it. */
export interface ElementState {
	readonly uid: number;
	readonly tag: string;
	readonly node: LynxElement;
	attrs: Record<string, unknown>;
	classes: string;
	id: string | null;
	/** The dataset as it was given: its values keep their types, the DOM's are all text. */
	dataset: Record<string, unknown>;
	/** Inline styles, in the order they were added: the set text's and `__AddInlineStyle`'s alike. */
	inlineStyles: Map<string, string>;
	listeners: RegisteredListener[];
	/** The main-thread functions bound to its events (`__AddEvent`), one per event name and type. */
	mainThreadEvents: BoundFunction[];
	/** The event types filed with a handler name (`__AddEvent` with a string), as `type:name`. */
	filedEvents: Set<string>;
	/** Its gesture detectors, by the id Lynx knows each by. */
	detectors: Map<number, Detector>;
	/** Its animations (`__ElementAnimate`), by name. */
	running: Map<string, RunningAnimation>;
	list?: ListState;
}

/** One `__InvokeUIMethod` call, as the logs list it. */
export interface InvocationLog {
	element: LynxElement;
	method: string;
	params: unknown;
	/** How many times the tree was flushed before the call. */
	flushesBefore: number;
	/** What the call answered: 0 success, 6 the element has no UI yet. */
	code: number;
}

/** One `__ElementAnimate` call. */
export interface AnimationLog {
	element: LynxElement;
	args: unknown[];
}

/** One `__AddEvent` call. */
export interface BindingLog {
	element: LynxElement;
	eventType: string;
	eventName: string;
	value: unknown;
}

/** One main-thread function the engine ran, and the `eventReturnResult` it read (0: none). */
export interface RunLog {
	source: "event" | "gesture";
	element: LynxElement;
	name: string;
	eventReturnResult: number;
}

/** One call a gesture callback made on the gesture manager. */
export type ManagerCallLog =
	| { op: "state"; element: LynxElement; id: number; state: number; detector: boolean }
	| { op: "consume"; element: LynxElement; id: number; params: unknown; detector: boolean };

/** One `__SetGestureDetector` or `__RemoveGestureDetector` call. */
export type GestureCallLog =
	| {
			op: "set";
			element: LynxElement;
			id: number;
			type: number;
			config: unknown;
			relations: unknown;
	  }
	| { op: "remove"; element: LynxElement; id: number };

/** What the page asked of the engine, in order. */
export interface EngineLogs {
	/** The options of each `__FlushElementTree`. */
	flushes: unknown[];
	invocations: InvocationLog[];
	animations: AnimationLog[];
	/** `__AddEvent` calls with a main-thread function, or none (which removes it). */
	workletEvents: BindingLog[];
	/** `__AddEvent` calls with a handler name, or none: the type filed for an element's event. */
	filings: BindingLog[];
	gestureCalls: GestureCallLog[];
	mainThreadRuns: RunLog[];
	gestureManagerCalls: ManagerCallLog[];
}

/** Answers a UI method: what the page's `invoke` gets back. */
export type Responder = (method: string, params: unknown, element: LynxElement) => InvokeResult;

/** Everything one engine holds, passed to the modules that make its functions. */
export interface EngineState {
	readonly document: Document;
	/** Where the page goes in the document. */
	readonly container: Element;
	nextUid: number;
	page: LynxElement | undefined;
	readonly states: WeakMap<Node, ElementState>;
	/** Every element made, attached or not, by unique id. */
	readonly made: Map<number, ElementState>;
	/**
	 * The elements made since the last `__FlushElementTree`: Lynx makes an element's UI when the
	 * tree is flushed.
	 */
	readonly unflushed: Set<ElementState>;
	/**
	 * The elements whose `flatten` went off since the last flush while they were flattened: the
	 * engine has not made their view yet.
	 */
	readonly stale: Set<ElementState>;
	/** Whether a plain `<view>` is flattened: off unless a test turns it on. */
	flattening: boolean;
	respond: Responder;
	readonly log: EngineLogs;
}

/** An `argument` error in the engine's own words: `__Name param 1 should be ...`. */
export function argumentError(name: string, index: number, expected: string): TypeError {
	return new TypeError(`${name} param ${index} should be ${expected}.`);
}

/** The record of `value`, which must be an element this engine made. */
export function stateOf(
	engine: EngineState,
	value: unknown,
	name: string,
	index: number,
): ElementState {
	// Boundary: the page's code may hand over anything; the registry only holds this engine's nodes.
	const state =
		typeof value === "object" && value !== null ? engine.states.get(value as Node) : undefined;
	if (!state) throw argumentError(name, index, "an element");
	return state;
}

/** The element as a message names it: its tag and its number. */
export function elementName(state: ElementState): string {
	return `<${state.tag}> ${state.uid}`;
}
