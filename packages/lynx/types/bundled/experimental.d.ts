// `@sohedra/lynx/experimental`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

import type { MainThread } from "@sohedra/lynx/elements";
import type { Gesture } from "@sohedra/lynx/gesture";
/** Several gestures on one element. */
declare class ComposedGesture extends GestureBase {
	private readonly type;
	private readonly gestures;
}
/**
 * Several gestures on one element, of which the first to begin wins. Experimental: Lynx follows
 * the relations of only the first detector of an element that has one, on iOS and Android.
 */
export class RaceGesture extends ComposedGesture {
	constructor(...gestures: Gesture[]);
}
/**
 * Several gestures on one element that may run together. Experimental, as `RaceGesture`: on
 * Android, a pan with a tap runs both, two pans only the second.
 */
export class SimultaneousGesture extends ComposedGesture {
	constructor(...gestures: Gesture[]);
}
/**
 * Several gestures on one element, in order of priority: each begins only once all before it
 * failed. Experimental, as `RaceGesture`.
 */
export class ExclusiveGesture extends ComposedGesture {
	constructor(...gestures: Gesture[]);
}
/** What every gesture class extends: marked as a gesture, which the main thread reads. */
declare class GestureBase {}
interface GestureBase extends Gesture {}
/** What every gesture takes besides its own options: the gestures it relates to. */
interface GestureRelations {
	/**
	 * Gestures this one may run together with, on another element around or inside this one: a
	 * drag on this element runs both. One that names nothing runs alone.
	 */
	simultaneousWith?: readonly Gesture[];
	/**
	 * Gestures this one waits for: it begins only once they failed.
	 *
	 * @experimental On Android a gesture that waits for one on an element around it never runs,
	 * since that one fails only when the finger lifts, and waiting for a scroll view inside a
	 * dragged element, or for a sibling, changes nothing; within one element, as `ExclusiveGesture`
	 * uses it, it works. iOS is not checked yet. A development build warns the first time a gesture
	 * is given it.
	 */
	waitFor?: readonly Gesture[];
	/**
	 * Gestures this one hands the touch to when it ends.
	 *
	 * @experimental No device has shown it working yet, on iOS or Android. A development build warns
	 * the first time a gesture is given it.
	 */
	continueWith?: readonly Gesture[];
}
/** The callbacks every gesture takes, each a main-thread function. */
interface GestureCallbacks<Event extends GestureChangeEvent> {
	/** A touch began that the gesture may recognize. */
	onBegin?: GestureCallback<Event>;
	/** The gesture is recognized. */
	onStart?: GestureCallback<Event>;
	/** The gesture is over, recognized or not: Lynx ends every gesture that began. */
	onEnd?: GestureCallback<Event>;
	onTouchesDown?: GestureCallback<Event>;
	onTouchesMove?: GestureCallback<Event>;
	onTouchesUp?: GestureCallback<Event>;
	onTouchesCancel?: GestureCallback<Event>;
}
/** The callbacks of a gesture that reports while it goes on. */
interface ContinuousGestureCallbacks<
	Event extends GestureChangeEvent,
> extends GestureCallbacks<Event> {
	/** The gesture moved. */
	onUpdate?: GestureCallback<Event>;
}
/** The options of a `LongPressGesture`. */
export interface LongPressGestureOptions
	extends GestureCallbacks<LongPressGestureChangeEvent>, GestureRelations {
	/** The shortest press, in milliseconds. Defaults to 500. */
	minDuration?: number;
	/** How far, in pixels, the touch may move. Defaults to 10. */
	maxDistance?: number;
}
/** The options of a `FlingGesture`. */
export type FlingGestureOptions = ContinuousGestureCallbacks<FlingGestureChangeEvent> &
	GestureRelations;
/** The options of a `NativeGesture`. */
export type NativeGestureOptions = ContinuousGestureCallbacks<NativeGestureChangeEvent> &
	GestureRelations;
/** One gesture: one detector of Lynx's on its element. */
declare class PlainGesture extends GestureBase {
	private readonly id;
	private readonly type;
	private readonly config;
	private readonly callbacks;
	private readonly waitFor;
	private readonly simultaneousWith;
	private readonly continueWith;
}
/** A long press. Experimental: Android ran it, and iOS has not yet. */
export class LongPressGesture extends PlainGesture {
	constructor(options?: LongPressGestureOptions);
}
/** A fling: a quick swipe. Experimental: on Android it ran no callback, slow or fast. */
export class FlingGesture extends PlainGesture {
	constructor(options?: FlingGestureOptions);
}
/** The platform's own recognizer. Experimental, as in Lynx. */
export class NativeGesture extends PlainGesture {
	constructor(options?: NativeGestureOptions);
}
/**
 * Where a touch is. A tap's `onStart` and `onEnd` carry none of it on Android: read it in
 * `onBegin`.
 */
interface GestureParams {
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
interface GestureChangeEvent<Params extends GestureParams = GestureParams> {
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
interface ScrollParams {
	scrollX: number;
	scrollY: number;
	/** Whether the element is scrolled to its start. */
	isAtStart: boolean;
	/** Whether the element is scrolled to its end. */
	isAtEnd: boolean;
}
/** How far a touch moved since the last event. */
interface DeltaParams {
	deltaX: number;
	deltaY: number;
}
/**
 * What a gesture's callback gets second: it moves the callback's own detector along. Lynx ends
 * every gesture that began, also one that never moved.
 */
interface StateManager {
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
type GestureCallback<Event extends GestureChangeEvent = GestureChangeEvent> = (
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

export {};
