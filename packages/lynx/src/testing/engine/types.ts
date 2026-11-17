// What the engine fake is made of: Lynx's element functions, and what it keeps and logs.

/**
 * An element of the page: a DOM element, or, for a `raw-text`, a DOM text node. Each is what the
 * engine hands the main thread, so a Testing Library query and the page's own code name the same
 * thing.
 */
export type LynxElement = Element | Text;

/** What a UI method answers: `code` 0 is success, 6 is "this element has no UI yet". */
export interface InvokeResult {
	code: number;
	data?: unknown;
}

/** A listener of an element's event: its event is Lynx's, not the DOM's. */
export type ListenerFunction = (event: unknown) => void;

/**
 * `__AddEventListener`'s options. `bind_type` is Lynx's `Event::BindType`: 1 bubble (the default),
 * 2 capture, 3 capture-catch, 4 bubble-catch, 5 global. The engine reads it only with
 * `closure_type` 2, a closure of the page's own; otherwise the listener is plain: it honors
 * `capture` and never catches.
 */
export interface ListenerOptions {
	capture?: boolean;
	closure_type?: number;
	bind_type?: number;
}

/** One callback of a gesture detector: the name Lynx calls it by, and the main-thread function. */
export interface GestureCallback {
	name: string;
	callback: unknown;
}

/** What `__SetGestureDetector` gets for a detector. */
export interface GestureConfig {
	callbacks: GestureCallback[];
	config?: unknown;
}

/** The detectors a gesture waits for, runs with or continues with. */
export interface GestureRelations {
	waitFor: number[];
	simultaneous: number[];
	continueWith: number[];
}

/** Lynx asks a list for the cell at `index`: the callback answers the cell's unique id. */
export type ComponentAtIndex = (
	list: LynxElement,
	listId: number,
	index: number,
	operationId: number,
) => number;

/** Lynx asks a list for several cells at once. */
export type ComponentAtIndexes = (
	list: LynxElement,
	listId: number,
	indexes: number[],
	operationIds: number[],
	reuse?: boolean,
	asyncFlush?: boolean,
) => void;

/** Lynx hands a cell back, to reuse it for another item. */
export type EnqueueComponent = (list: LynxElement, listId: number, sign: number) => void;

/** A change of a list's items: what `update-list-info` carries. */
export interface ListUpdate {
	insertAction: Record<string, unknown>[];
	removeAction: number[];
	updateAction: Record<string, unknown>[];
}
