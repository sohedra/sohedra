// The gesture classes: each instance is the gesture as it crosses to the main thread
// (../wire/gesture.ts), held in fields of its own, so it is sent as it is. The main thread sets one
// detector of Lynx's for each plain gesture of an element's `main-thread:gesture`.
//
// Lynx's limits, which no binding can lift (lynx-family/lynx):
//   - one gesture of each type per element: each platform keeps an element's handlers by type
//     (Android BaseGestureHandler.convertToGestureHandler, iOS LynxBaseGestureHandler);
//   - a pan reads only `minDistance` (Android PanGestureHandler, iOS LynxPanGestureHandler);
//   - only the first detector of an element, in id order, that has a `waitFor` or `continueWith`
//     relation follows it, on iOS and Android (GestureDetectorManager);
//   - iOS reads no option of a `DefaultScrollGesture` (LynxDefaultGestureHandler);
//   - iOS reads a missing duration or distance as 0, so every option with a default is written.
//
// What Android shows (Lynx 4.2), which the classes' comments carry where a developer meets it:
//   - a detector set again during a touch gives the drag no `onEnd`: a new `onBegin` follows at
//     once under the finger, and setting one gesture of an element again restarts the drag of the
//     element's others;
//   - a gesture that failed or ended is tried again on the next move, so `onBegin` and `onEnd` may
//     run several times in one touch (GestureHandlerTrigger.reCompeteByGestures).
//
// Adapted from @lynx-js/gesture-runtime (lynx-stack/packages/lynx/gesture-runtime/src), Copyright
// 2025 The Lynx Authors, Apache License 2.0: the shape and the types.

// By the entry's name: every entry's declarations then name the one `Gesture`, whose brand only
// these classes carry.
import type { Gesture } from "@sohedra/lynx/gesture";

import { GestureType, isGesture, isMainThreadFunction, plainGestures } from "../wire/index.ts";
import type {
	GestureRef,
	MainThreadFunction,
	SerializedGesture,
	SerializedPlainGesture,
} from "../wire/index.ts";
import { gestureError } from "./catalogue.ts";
import { DEV, MAIN_THREAD, reportWarning } from "./globals.ts";
import type {
	DefaultScrollGestureChangeEvent,
	FlingGestureChangeEvent,
	GestureCallback,
	GestureChangeEvent,
	LongPressGestureChangeEvent,
	NativeGestureChangeEvent,
	PanGestureChangeEvent,
	TapGestureChangeEvent,
} from "./types.ts";

// The class's type carries the brand of `Gesture`, which no value has: a plain object is no gesture.
/* oxlint-disable typescript/no-unsafe-declaration-merging -- the brand is a type, never read */
/** What every gesture class extends: marked as a gesture, which the main thread reads. */
export abstract class GestureBase {
	/** @internal */
	readonly __isSerialized: true = true;
}
export interface GestureBase extends Gesture {}
/* oxlint-enable typescript/no-unsafe-declaration-merging */

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

/** The callbacks a gesture takes, in the order it sends them. */
const CALLBACKS = [
	"onBegin",
	"onStart",
	"onUpdate",
	"onEnd",
	"onTouchesDown",
	"onTouchesMove",
	"onTouchesUp",
	"onTouchesCancel",
] as const;

let made = 0;

/** A new gesture's own id: the first frame's negative, the background's positive, never twice. */
function nextId(): number {
	made++;
	return MAIN_THREAD ? -made : made;
}

/** `gesture` as it crosses, or `undefined` when it is no gesture. */
export function crossing(gesture: unknown): SerializedGesture | undefined {
	return isGesture(gesture) ? gesture : undefined;
}

/** `refs` with the plain gestures of `more` it lacks, leaving out `self`: `refs` if none. */
export function merge(refs: GestureRef[], more: readonly GestureRef[], self: number): GestureRef[] {
	let merged: GestureRef[] | undefined;
	for (const ref of more) {
		const list = merged ?? refs;
		if (ref.id === self || list.some((other) => other.id === ref.id)) continue;
		(merged ??= [...refs]).push({ id: ref.id });
	}
	return merged ?? refs;
}

/** The refs of the plain gestures of `gestures`. */
export function refsOf(gestures: readonly SerializedGesture[]): GestureRef[] {
	return gestures.flatMap((gesture) => plainGestures(gesture).map((plain) => ({ id: plain.id })));
}

/** A relation option of every gesture. */
type RelationName = keyof GestureRelations;

/** The relation options no device has shown working: each warns once, in a development build. */
const EXPERIMENTAL_RELATIONS = ["waitFor", "continueWith"] as const;

const warned = new Set<RelationName>();

/**
 * Warns, in a development build, the first time a gesture is given the experimental relation
 * `name`. Only the background warns: it builds every gesture the first frame built, so the
 * warning comes once.
 */
function warnExperimental(place: {
	gesture: string;
	name: (typeof EXPERIMENTAL_RELATIONS)[number];
}): void {
	if (!DEV || MAIN_THREAD || warned.has(place.name)) return;
	warned.add(place.name);
	reportWarning(gestureError({ code: "gesture_relation_experimental", details: place }));
}

/** The refs a relation option names; throws, naming the option, when it holds something else. */
function relation(
	gestures: unknown,
	place: { gesture: string; name: RelationName },
	self: number,
): GestureRef[] {
	if (gestures === undefined) return [];
	if (!Array.isArray(gestures))
		throw gestureError({ code: "gesture_relation_not_a_list", details: place });
	const values = gestures.map((gesture) => {
		const value = crossing(gesture);
		if (!value) throw gestureError({ code: "gesture_relation_not_gesture", details: place });
		return value;
	});
	return merge([], refsOf(values), self);
}

/** What a plain gesture is made from. */
interface PlainParts {
	/** The class's name, for messages. */
	gesture: string;
	type: SerializedPlainGesture["type"];
	config: Record<string, unknown>;
	options: GestureRelations & { readonly [Name in (typeof CALLBACKS)[number]]?: unknown };
}

/** One gesture: one detector of Lynx's on its element. */
abstract class PlainGesture extends GestureBase {
	// The fields are the gesture as it crosses, in the order it is written.
	private readonly id: number;
	private readonly type: SerializedPlainGesture["type"];
	private readonly config: Record<string, unknown>;
	private readonly callbacks: Record<string, MainThreadFunction>;
	private readonly waitFor: GestureRef[];
	private readonly simultaneousWith: GestureRef[];
	private readonly continueWith: GestureRef[];

	/** @internal */
	protected constructor({ gesture, type, config, options }: PlainParts) {
		super();
		this.id = nextId();
		this.type = type;
		this.config = config;
		this.callbacks = {};
		for (const name of CALLBACKS) {
			const callback = options[name];
			if (callback === undefined) continue;
			if (!isMainThreadFunction(callback))
				throw gestureError({
					code: "gesture_callback_not_main_thread",
					details: { gesture, name },
				});
			this.callbacks[name] = callback;
		}
		this.waitFor = relation(options.waitFor, { gesture, name: "waitFor" }, this.id);
		this.simultaneousWith = relation(
			options.simultaneousWith,
			{ gesture, name: "simultaneousWith" },
			this.id,
		);
		this.continueWith = relation(options.continueWith, { gesture, name: "continueWith" }, this.id);
		for (const name of EXPERIMENTAL_RELATIONS)
			if (options[name] !== undefined) warnExperimental({ gesture, name });
	}
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
	constructor(options: PanGestureOptions = {}) {
		super({
			gesture: "PanGesture",
			type: GestureType.PAN,
			config: { minDistance: options.minDistance ?? 0 },
			options,
		});
	}
}

/**
 * A tap. `new TapGesture({ maxDuration, maxDistance, onStart, onEnd })`, each callback a
 * main-thread function: `onStart` and `onEnd` for a quick tap; a hold past `maxDuration` or a
 * move past `maxDistance` gives no `onStart`, and after such a move `onEnd` may come on every
 * later move. Only `onBegin`'s event says where the touch is: `onStart`'s and `onEnd`'s carry no
 * `x` or `y` on Android. A rebuild behaves as `PanGesture` says.
 */
export class TapGesture extends PlainGesture {
	constructor(options: TapGestureOptions = {}) {
		super({
			gesture: "TapGesture",
			type: GestureType.TAP,
			config: { maxDuration: options.maxDuration ?? 500, maxDistance: options.maxDistance ?? 10 },
			options,
		});
	}
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
	constructor(options: DefaultScrollGestureOptions = {}) {
		super({
			gesture: "DefaultScrollGesture",
			type: GestureType.DEFAULT,
			config: { tapSlop: options.tapSlop ?? 3 },
			options,
		});
	}
}

/** A long press. Experimental: Android ran it, and iOS has not yet. */
export class LongPressGesture extends PlainGesture {
	constructor(options: LongPressGestureOptions = {}) {
		super({
			gesture: "LongPressGesture",
			type: GestureType.LONGPRESS,
			config: { minDuration: options.minDuration ?? 500, maxDistance: options.maxDistance ?? 10 },
			options,
		});
	}
}

/** A fling: a quick swipe. Experimental: on Android it ran no callback, slow or fast. */
export class FlingGesture extends PlainGesture {
	constructor(options: FlingGestureOptions = {}) {
		super({
			gesture: "FlingGesture",
			type: GestureType.FLING,
			config: {},
			options,
		});
	}
}

/** The platform's own recognizer. Experimental, as in Lynx. */
export class NativeGesture extends PlainGesture {
	constructor(options: NativeGestureOptions = {}) {
		super({
			gesture: "NativeGesture",
			type: GestureType.NATIVE,
			config: {},
			options,
		});
	}
}
