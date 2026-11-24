// A gesture as it travels: the value of `main-thread:gesture`, which the background and the first
// frame write and the main thread turns into Lynx's gesture detectors. The shape is that of
// `@lynx-js/gesture-runtime`. A gesture class's instance is this shape itself, so it crosses as it
// is.

import type { MainThreadFunction } from "./main-thread-functions.ts";

/** Gesture types as Lynx's detectors number them; a composed gesture holds several. */
export const GestureType = {
	COMPOSED: -1,
	PAN: 0,
	FLING: 1,
	DEFAULT: 2,
	TAP: 3,
	LONGPRESS: 4,
	ROTATION: 5,
	PINCH: 6,
	NATIVE: 7,
} as const;

/** One of `GestureType`'s numbers. */
export type GestureType = (typeof GestureType)[keyof typeof GestureType];

/**
 * The states a gesture's callback moves its detector to, through the engine's gesture manager
 * (`__SetGestureState`): it takes the touch, it gives it up, it is over.
 */
export const GestureState = { ACTIVE: 1, FAIL: 2, END: 3 } as const;

/** Another gesture, by its id, in a relation. */
export interface GestureRef {
	id: number;
}

/** One gesture, which becomes one detector on its element. */
export interface SerializedPlainGesture {
	/**
	 * Its own id, which relations name it by: the background's are positive and the first frame's
	 * negative, and neither is given twice. Lynx knows the detector by another id, which the main
	 * thread gives out.
	 */
	id: number;
	type: Exclude<GestureType, typeof GestureType.COMPOSED>;
	/** What the engine reads of it, by name (`minDistance`). */
	config: Record<string, unknown>;
	/** Its callbacks, by name (`onUpdate`), each a main-thread function. */
	callbacks: Record<string, MainThreadFunction>;
	waitFor: GestureRef[];
	simultaneousWith: GestureRef[];
	continueWith: GestureRef[];
	__isSerialized: true;
}

/** Several gestures on one element. */
interface SerializedComposedGesture {
	type: typeof GestureType.COMPOSED;
	gestures: SerializedGesture[];
	__isSerialized: true;
}

/** A gesture as it travels. */
export type SerializedGesture = SerializedPlainGesture | SerializedComposedGesture;

/** Whether an attribute's value is a gesture: it carries the mark. */
export function isGesture(value: unknown): value is SerializedGesture {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as Record<string, unknown>)["__isSerialized"] === true
	);
}

/** The plain gestures of `gesture`, each once, in order: one detector each. */
export function plainGestures(gesture: SerializedGesture): SerializedPlainGesture[] {
	const out: SerializedPlainGesture[] = [];
	collect(gesture, out, new Set());
	return out;
}

function collect(gesture: SerializedGesture, out: SerializedPlainGesture[], seen: Set<number>) {
	if (gesture.type === GestureType.COMPOSED) {
		for (const part of gesture.gestures) collect(part, out, seen);
	} else if (!seen.has(gesture.id)) {
		seen.add(gesture.id);
		out.push(gesture);
	}
}
