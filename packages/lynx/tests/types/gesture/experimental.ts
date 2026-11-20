// Checked by `pnpm check`, not run. `@sohedra/lynx/experimental`: the gestures that wait for a
// device probe, each made from one options object, composed and related as the stable ones.

import {
	ExclusiveGesture,
	FlingGesture,
	LongPressGesture,
	NativeGesture,
	RaceGesture,
	SimultaneousGesture,
} from "@sohedra/lynx/experimental";
import type {
	ExperimentalStateManager,
	FlingGestureChangeEvent,
	FlingGestureOptions,
	LongPressGestureOptions,
	NativeGestureChangeEvent,
} from "@sohedra/lynx/experimental";
import type { Gesture, StateManager } from "@sohedra/lynx/gesture";

const onEnd = (event: FlingGestureChangeEvent, state: StateManager): void => {
	const velocity: number = event.params.deltaX;
	// The calls no device has shown working are reached through the experimental type.
	(state as ExperimentalStateManager).interceptGesture(velocity > 0);
};
const fling: FlingGesture = new FlingGesture({ onEnd } satisfies FlingGestureOptions);
const press: LongPressGesture = new LongPressGesture({
	minDuration: 300,
	maxDistance: 8,
} satisfies LongPressGestureOptions);
const native = new NativeGesture({
	onUpdate: (event: NativeGestureChangeEvent) => void event.params.scrollY,
});
const related = new FlingGesture({ onEnd, waitFor: [press], continueWith: [native] });
const composed: Gesture[] = [
	new RaceGesture(fling, press),
	new SimultaneousGesture(press, native),
	new ExclusiveGesture(related, press),
];
void composed;

// @ts-expect-error the press's duration is a number of milliseconds.
void new LongPressGesture({ minDuration: "300ms" });
// @ts-expect-error a gesture waits for gestures, not for elements.
void new LongPressGesture({ waitFor: ["view"] });
