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
// Adapted from @lynx-js/gesture-runtime (lynx-stack/packages/lynx/gesture-runtime/src), Copyright
// 2025 The Lynx Authors, Apache License 2.0: the shape and the types.

import { GestureType, isGesture, isMainThreadFunction, plainGestures } from "../wire/index.ts";
import type {
	GestureRef,
	MainThreadFunction,
	SerializedGesture,
	SerializedPlainGesture,
} from "../wire/index.ts";
import { gestureError } from "./catalogue.ts";
import { MAIN_THREAD } from "./globals.ts";
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

/** What every gesture is: marked as one, which the main thread reads. */
export abstract class Gesture {
	private readonly __isSerialized: true = true;
}

/**
 * A gesture: what `main-thread:gesture` takes, and what `waitFor` and `simultaneousWith` name.
 * Only the gesture classes make one.
 */
export interface GestureKind extends Gesture {}

/** What every gesture takes besides its own options. */
export interface GestureRelations {
	/** Gestures, on this element or another, this one waits for: it begins only once they fail. */
	waitFor?: readonly GestureKind[];
	/** Gestures, on this element or another, this one may run together with. */
	simultaneousWith?: readonly GestureKind[];
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
	/** How far, in pixels, a touch moves before the element scrolls. Defaults to 3; iOS reads none. */
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

/** `kind` as it crosses, or `undefined` when it is no gesture. */
export function crossing(kind: unknown): SerializedGesture | undefined {
	return isGesture(kind) ? kind : undefined;
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

/** The gestures a relation option holds; throws, naming the option, when it holds something else. */
function relation(kinds: unknown, place: { gesture: string; name: string }): SerializedGesture[] {
	if (kinds === undefined) return [];
	if (!Array.isArray(kinds))
		throw gestureError({ code: "gesture_relation_not_a_list", details: place });
	return kinds.map((kind) => {
		const value = crossing(kind);
		if (!value) throw gestureError({ code: "gesture_relation_not_gesture", details: place });
		return value;
	});
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
abstract class PlainGesture extends Gesture {
	// The fields are the gesture as it crosses, in the order it is written.
	private readonly id: number;
	private readonly type: SerializedPlainGesture["type"];
	private readonly config: Record<string, unknown>;
	private readonly callbacks: Record<string, MainThreadFunction>;
	private readonly waitFor: GestureRef[];
	private readonly simultaneousWith: GestureRef[];
	private readonly continueWith: GestureRef[];

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
		this.waitFor = merge(
			[],
			refsOf(relation(options.waitFor, { gesture, name: "waitFor" })),
			this.id,
		);
		this.simultaneousWith = merge(
			[],
			refsOf(relation(options.simultaneousWith, { gesture, name: "simultaneousWith" })),
			this.id,
		);
		this.continueWith = [];
	}
}

/**
 * A pan: the finger drags. `const pan = $derived(new PanGesture({ minDistance: 4, onUpdate }))`,
 * each callback a main-thread function; a callback calls `state.active()` to take the touch. Build
 * a gesture in `$derived` when its callbacks capture the component's values, so it follows them.
 *
 * Built again with the same options but other callbacks, or callbacks that captured other values,
 * a gesture keeps its detector, and a drag goes on with the new callbacks. A change of the
 * gesture's type, its options, what it waits for or runs with, or which callbacks it has sets the
 * detector again, which ends a drag; so does taking the gesture away, with `undefined` or `false`
 * (`main-thread:gesture={on && pan}`).
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
 * main-thread function. A drag goes on across a rebuild as `PanGesture` says.
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
 * The scrolling a `<scroll-view>` or a `<list>` does by itself, as a gesture. Set on the scrolling
 * element, it makes the element's scrolling a gesture that others can name in their relations
 * (`waitFor: [scroll]`), and its callbacks see the scrolling. Its callbacks are optional, each a
 * main-thread function.
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

/** A long press. Experimental: no device has shown it on an element yet. */
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

/** A fling: a quick swipe. Experimental: no device has shown it on an element yet. */
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
