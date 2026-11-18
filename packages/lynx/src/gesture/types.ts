// What a gesture's callbacks get: the gesture's event, and the state manager of its detector.

/** The element a gesture is on, as a main-thread function gets it. */
export interface GestureElement {
	/** The element's parent, up to the page; `null` above it. */
	readonly parentElement: GestureElement | null;
	/** The element's `data-*` attributes. */
	readonly dataset: Record<string, unknown>;
	/** Whether `other` is this element or inside it. */
	contains(other: GestureElement): boolean;
	getAttribute(name: string): unknown;
	setAttribute(name: string, value: unknown): void;
	/** Sets one style; a later `style` from the background keeps it. */
	setStyleProperty(name: string, value: string | number | null): void;
	/** Sets several styles at once. */
	setStyleProperties(styles: Record<string, string | number | null>): void;
	querySelector(selector: string): GestureElement | null;
	querySelectorAll(selector: string): GestureElement[];
	getAttributeNames(): string[];
	/** The value a style of the element has now, as laid out. */
	getComputedStyleProperty(name: string): string;
	/** Animates the element; a number is the duration in milliseconds. */
	animate(
		keyframes: Record<string, string | number>[],
		options?: number | Record<string, unknown>,
	): { cancel(): void; pause(): void; play(): void };
	/** Calls one of the element's UI methods, once the frame it is in is laid out. */
	invoke(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Where a touch is. A tap's `onStart` and `onEnd` carry none of it on Android: read it in
 * `onBegin`.
 */
export interface GestureParams {
	/** On the page. */
	pageX: number;
	pageY: number;
	/** On the screen of the Lynx view. */
	clientX: number;
	clientY: number;
	/** On the element the gesture is on. */
	x: number;
	y: number;
}

/** What a gesture's callback gets first. */
export interface GestureChangeEvent<Params extends GestureParams = GestureParams> {
	/** The callback's name: `onBegin`, `onUpdate` and the others. */
	type: string;
	/** When it happened, in milliseconds: on the event, not in `params`. */
	timestamp: number;
	/** The element the gesture is on, as `currentTarget`: a gesture names no touched element. */
	target: GestureElement;
	/** The element the gesture is on. */
	currentTarget: GestureElement;
	params: Params;
}

/** Where a scrolling element stands, as a pan's event has it. */
export interface ScrollParams {
	scrollX: number;
	scrollY: number;
	/** Whether the element is scrolled to its start. */
	isAtStart: boolean;
	/** Whether the element is scrolled to its end. */
	isAtEnd: boolean;
}

/** How far a touch moved since the last event. */
export interface DeltaParams {
	deltaX: number;
	deltaY: number;
}

/** What a `PanGesture`'s callbacks get. */
export type PanGestureChangeEvent = GestureChangeEvent<GestureParams & ScrollParams>;

/** What a `TapGesture`'s callbacks get. */
export type TapGestureChangeEvent = GestureChangeEvent;

/** What a `DefaultScrollGesture`'s callbacks get. */
export type DefaultScrollGestureChangeEvent = GestureChangeEvent<
	GestureParams & ScrollParams & DeltaParams
>;

/**
 * What a gesture's callback gets second: it moves the callback's own detector along. Lynx ends
 * every gesture that began, also one that never moved.
 */
export interface StateManager {
	/**
	 * The gesture takes the touch from the gestures that compete for it. A scroll view around the
	 * element with no gesture of its own still scrolls.
	 */
	active(): void;
	/** The gesture gives the touch up to the others; it is tried again on the next move. */
	fail(): void;
	/** The gesture is over: its `onEnd` runs, and the next touch begins it again. */
	end(): void;
}

/** A gesture's callback: a main-thread function, whose body starts with `'main thread'`. */
export type GestureCallback<Event extends GestureChangeEvent = GestureChangeEvent> = (
	event: Event,
	state: StateManager,
) => void;

/**
 * The state manager with the two calls no device has shown working yet: a callback's `state` is
 * one, typed as this with a cast (`state as ExperimentalStateManager`).
 */
export interface ExperimentalStateManager extends StateManager {
	/** Lynx's `consumeGesture` on the gesture's element: what it does is the element's own. */
	consumeGesture(consume: boolean): void;
	/** Lynx's `interceptGesture` on the gesture's element: what it does is the element's own. */
	interceptGesture(intercept: boolean): void;
}

/** What a `LongPressGesture`'s callbacks get. */
export type LongPressGestureChangeEvent = GestureChangeEvent;

/** What a `FlingGesture`'s callbacks get. */
export type FlingGestureChangeEvent = GestureChangeEvent<
	GestureParams & ScrollParams & DeltaParams
>;

/** What a `NativeGesture`'s callbacks get. */
export type NativeGestureChangeEvent = GestureChangeEvent<
	GestureParams & ScrollParams & DeltaParams
>;
