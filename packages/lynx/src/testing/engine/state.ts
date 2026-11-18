// What the engine keeps: a record for each element it made, and the logs of what the page asked.

import type { FrameQueue } from "./frames.ts";
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
	/** When it was bound: an element's bindings run in this order. */
	seq: number;
}

/** A main-thread function bound to an element's event with `__AddEvent`. */
export interface BoundFunction {
	/** `bindEvent`, `catchEvent`, `capture-bind`, `capture-catch` or `global-bindEvent`. */
	eventType: string;
	eventName: string;
	/** The function as the engine holds it: opaque, handed to the global `runWorklet`. */
	value: unknown;
	/** When it was bound: an element's bindings run in this order. */
	seq: number;
}

/** A handler name bound to an element's event with `__AddEvent`: the engine sends it the event. */
export interface BoundHandler {
	/** `bindEvent`, `catchEvent`, `capture-bind`, `capture-catch` or `global-bindEvent`. */
	eventType: string;
	eventName: string;
	/** The name the background knows its handler by. */
	handler: string;
	/** When it was bound: an element's bindings run in this order. */
	seq: number;
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

/** An animation started with `__ElementAnimate`, until it is canceled. */
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
	/** How many items the updates have given the list so far. */
	items: number;
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
	/** Its inline custom properties, as the engine last read them. */
	variables: Map<string, string>;
	/** The style text set and not read yet: the engine reads it at the flush, or before a style is added. */
	styleText: string | undefined;
	/** Whether its inline style changed since the last flush. */
	restyled: boolean;
	/** Whether, since the last flush, a change of its custom properties was recorded for its descendants. */
	variablesChanged: boolean;
	listeners: RegisteredListener[];
	/** The main-thread functions bound to its events (`__AddEvent`), one per event name and type. */
	mainThreadEvents: BoundFunction[];
	/** The handler names bound to its events (`__AddEvent`), one per event name and type. */
	handlers: BoundHandler[];
	/**
	 * The events its data model has a handler for (`__AddEvent` with anything but none), as
	 * `type:name`: the engine reads `global-bindEvent` ones to find who hears the global phase.
	 */
	filedEvents: Set<string>;
	/** Its gesture detectors, by the id Lynx knows each by. */
	detectors: Map<number, Detector>;
	/** Its animations (`__ElementAnimate`), by name. */
	running: Map<string, RunningAnimation>;
	/**
	 * Whether Lynx may lay it out with no UI: not once it was put straight in a scroll view, even if
	 * it was taken out again (layout-only.ts).
	 */
	canBeLayoutOnly: boolean;
	/** Whether `__CreateScrollView` made it: Lynx gives its children a UI (layout-only.ts). */
	scrollView: boolean;
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

/** One event the engine sent to a handler name, for the background. */
export interface BackgroundEventLog {
	/** The element whose binding sent it. */
	element: LynxElement;
	eventType: string;
	eventName: string;
	handler: string;
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
	/** The events the engine sent to handler names. */
	backgroundEvents: BackgroundEventLog[];
	gestureManagerCalls: ManagerCallLog[];
}

/** Answers a UI method: what the page's `invoke` gets back. */
/**
 * What the screen shows of an element: its classes, attributes and inline styles as the last flush
 * of the tree left them. Lynx applies an element's changes to its view at the flush.
 */
export interface ShownElement {
	readonly classes: string;
	readonly attrs: Readonly<Record<string, unknown>>;
	readonly inlineStyles: ReadonlyMap<string, string>;
	/** The custom properties it resolved, its own and those it inherits. */
	readonly customProperties: ReadonlyMap<string, string>;
	/** Its children. */
	readonly children: readonly LynxElement[];
}

/**
 * Decides what a UI method answers, from the method, its params, the element, the element as the
 * screen shows it (`undefined` before a flush has found it in the page), and the element as the
 * platform last measured it: at the frame after a flush, as Android measures (frames.ts).
 */
export type Responder = (
	method: string,
	params: unknown,
	element: LynxElement,
	shown: ShownElement | undefined,
	measured: ShownElement | undefined,
) => InvokeResult;

/** Everything one engine holds, passed to the modules that make its functions. */
export interface EngineState {
	readonly document: Document;
	/** Where the page goes in the document. */
	readonly container: Element;
	nextUid: number;
	/** The number of the next binding: an element's bindings run in the order they were made. */
	nextBinding: number;
	page: LynxElement | undefined;
	readonly states: WeakMap<Node, ElementState>;
	/** Every element made, attached or not, by unique id. */
	readonly made: Map<number, ElementState>;
	/**
	 * The elements Lynx has made a UI for: at the flush that finds one in the page, unless it is
	 * layout-only then (layout-only.ts). An element keeps its UI.
	 */
	readonly withUi: Set<ElementState>;
	/** Each element as the last flush that found it in the page left it. */
	readonly shown: WeakMap<ElementState, ShownElement>;
	/** Each element as the platform last measured it: at the frame after a flush (frames.ts). */
	readonly measured: WeakMap<ElementState, ShownElement>;
	/** The main thread's frame callbacks, and whether a frame is coming. */
	readonly frames: FrameQueue;
	/**
	 * The elements in the global phase, with the event names they hear there: an element enters at
	 * the flush that finds its `global-bindEvent` filed, and leaves when it is destroyed.
	 */
	readonly globalPhase: Map<ElementState, Set<string>>;
	respond: Responder;
	/** Runs `deliver` when the engine's answer comes back from another thread. */
	readonly schedule: (deliver: () => void) => void;
	/** Runs before the engine calls the page's main-thread code. */
	readonly enter: () => void;
	/** Where the engine reports what Lynx reports and carries on from. */
	readonly report: (error: Error) => void;
	readonly log: EngineLogs;
}

/** Which argument of which function: `{ fn: "__AppendElement", index: 1 }`. */
export interface ArgumentPlace {
	fn: string;
	index: number;
}

/**
 * An argument error close to the engine's own words (`FiberAppendElement param 1 should be
 * RefCounted`, core/runtime/lepus/bindings/renderer_functions.cc,
 * CONVERT_ARG_AND_CHECK_FOR_ELEMENT_API): `__Name param 1 should be ...`.
 */
export function argumentError(where: ArgumentPlace & { expected: string }): TypeError {
	return new TypeError(`${where.fn} param ${where.index} should be ${where.expected}.`);
}

/** The record of `where.value`, which must be an element this engine made. */
export function stateOf(
	engine: EngineState,
	where: ArgumentPlace & { value: unknown },
): ElementState {
	const { value } = where;
	const state =
		// Boundary: the page's code may hand over anything; the registry holds only this engine's nodes.
		typeof value === "object" && value !== null ? engine.states.get(value as Node) : undefined;
	if (!state) throw argumentError({ ...where, expected: "an element" });
	return state;
}

/** The element as a message names it: its tag and its number. */
export function elementName(state: ElementState): string {
	return `<${state.tag}> ${state.uid}`;
}
