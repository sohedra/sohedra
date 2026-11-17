// A gesture as it travels: the value of `main-thread:gesture`, which the background writes and the
// main thread turns into Lynx's gesture detectors. The shape is that of `@lynx-js/gesture-runtime`.

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

/** Another gesture, by its id, in a relation. */
export interface GestureRef {
	id: number;
}

/** One gesture, which becomes one detector on its element. */
export interface SerializedPlainGesture {
	id: number;
	type: Exclude<GestureType, typeof GestureType.COMPOSED>;
	config: Record<string, unknown>;
	/** Its callbacks, by name (`onUpdate`), each a main-thread function. */
	callbacks: Record<string, MainThreadFunction>;
	waitFor: GestureRef[];
	simultaneousWith: GestureRef[];
	continueWith: GestureRef[];
	__isSerialized: true;
}

/** Several gestures on one element. */
export interface SerializedComposedGesture {
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
		"__isSerialized" in value &&
		value.__isSerialized === true
	);
}
