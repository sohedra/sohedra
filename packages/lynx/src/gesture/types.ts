// What a gesture's callbacks get: the gesture's event, and the state manager of its detector.

// By the entry's name: a gesture's element is the one type of a main-thread element, which a ref
// and a main-thread event have too.
import type { MainThread } from "@sohedra/lynx/elements";

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
	target: MainThread.Element;
	/** The element the gesture is on. */
	currentTarget: MainThread.Element;
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
