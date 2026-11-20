// `@sohedra/lynx/gesture`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

/**
 * What every gesture class extends: marked as a gesture, which the main thread reads. The mark is
 * public, so a gesture is one to every entry's declarations, which each declare the classes they
 * export.
 */
declare class GestureBase {
	readonly __isSerialized: true;
}
/**
 * A gesture: what `main-thread:gesture` takes, and what a gesture's relations name. Only the
 * gesture classes make one.
 */
export interface Gesture extends GestureBase {}
/** What every gesture takes besides its own options: the gestures it relates to. */
export interface GestureRelations {
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
export interface GestureCallbacks<Event extends GestureChangeEvent> {
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
export interface ContinuousGestureCallbacks<
	Event extends GestureChangeEvent,
> extends GestureCallbacks<Event> {
	/** The gesture moved. */
	onUpdate?: GestureCallback<Event>;
}
/** The options of a `PanGesture`. */
export interface PanGestureOptions
	extends ContinuousGestureCallbacks<PanGestureChangeEvent>, GestureRelations {
	/**
	 * How far, in pixels, the touch moves before the pan begins. Defaults to 0. The pan reads no
	 * other distance: to begin it only near an edge, check `event.params.x` in `onBegin` and call
	 * `state.fail()` elsewhere.
	 */
	minDistance?: number;
}
/** The options of a `TapGesture`. */
export interface TapGestureOptions
	extends GestureCallbacks<TapGestureChangeEvent>, GestureRelations {
	/** The longest tap, in milliseconds. Defaults to 500. */
	maxDuration?: number;
	/** How far, in pixels, the touch may move. Defaults to 10. */
	maxDistance?: number;
}
/** The options of a `DefaultScrollGesture`. */
export interface DefaultScrollGestureOptions
	extends ContinuousGestureCallbacks<DefaultScrollGestureChangeEvent>, GestureRelations {
	/**
	 * How far, in pixels, one move goes before the touch stops counting as a tap. Defaults to 3; it
	 * does not hold off scrolling on Android, which scrolls on every move, and iOS reads none.
	 */
	tapSlop?: number;
}
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
/**
 * A pan: the finger drags. `const pan = $derived(new PanGesture({ minDistance: 4, onUpdate }))`,
 * each callback a main-thread function. Build a gesture in `$derived` when its callbacks capture
 * the component's values, so it follows them. A pan runs without `state.active()` when no other
 * gesture competes for the touch; `active()` takes the touch from a competing gesture, though not
 * from a scroll view around the element that has no gesture of its own, which scrolls too.
 *
 * Built again with the same options but other callbacks, or callbacks that captured other values,
 * a gesture keeps its detector, and a drag goes on with the new callbacks. A change of the
 * gesture's type, its options, what it runs with, or which callbacks it has sets the detector
 * again: the drag gets no `onEnd`, and a new `onBegin` follows under the finger. Setting another
 * gesture of the same element again does the same to this one. Taking the gesture away, with
 * `undefined` or `false` (`main-thread:gesture={on && pan}`), stops its callbacks.
 *
 * `onBegin` and `onEnd` may run more than once in one touch: a gesture that called `fail()` or
 * ended is tried again on the next move.
 */
export class PanGesture extends PlainGesture {
	constructor(options?: PanGestureOptions);
}
/**
 * A tap. `new TapGesture({ maxDuration, maxDistance, onStart, onEnd })`, each callback a
 * main-thread function: `onStart` and `onEnd` for a quick tap; a hold past `maxDuration` or a
 * move past `maxDistance` gives no `onStart`, and after such a move `onEnd` may come on every
 * later move. Only `onBegin`'s event says where the touch is: `onStart`'s and `onEnd`'s carry no
 * `x` or `y` on Android. A rebuild behaves as `PanGesture` says.
 */
export class TapGesture extends PlainGesture {
	constructor(options?: TapGestureOptions);
}
/**
 * The scrolling a `<scroll-view>` or a `<list>` does by itself, as a gesture: its callbacks see the
 * scrolling (`deltaY`, `isAtStart`, `isAtEnd`), and others can name it in their relations. Its
 * callbacks are optional, each a main-thread function.
 *
 * Set on a scroll view inside another, it changes how they scroll: a drag or a fling on it scrolls
 * both, where without it only the inner one scrolls.
 */
export class DefaultScrollGesture extends PlainGesture {
	constructor(options?: DefaultScrollGestureOptions);
}
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
	): {
		cancel(): void;
		pause(): void;
		play(): void;
	};
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

export {};
