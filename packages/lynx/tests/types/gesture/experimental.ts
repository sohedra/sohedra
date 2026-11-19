// Checked by `pnpm check`, not run. `@sohedra/lynx/experimental`: the gestures and calls that wait
// for a device probe, each made from one options object, composed and related as the stable ones.

import {
	continueWith,
	ExclusiveGesture,
	FlingGesture,
	LongPressGesture,
	NativeGesture,
	RaceGesture,
	SimultaneousGesture,
	waitFor,
} from "@sohedra/lynx/experimental";
import type {
	ExperimentalStateManager,
	FlingGestureChangeEvent,
	FlingGestureOptions,
	LongPressGestureOptions,
	NativeGestureChangeEvent,
} from "@sohedra/lynx/experimental";
import type { GestureKind, StateManager } from "@sohedra/lynx/gesture";

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
const related: FlingGesture = continueWith(waitFor(fling, [press]), [native]);
const composed: GestureKind[] = [
	new RaceGesture(fling, press),
	new SimultaneousGesture(press, native),
	new ExclusiveGesture(related, press),
];
void composed;

// @ts-expect-error the press's duration is a number of milliseconds.
void new LongPressGesture({ minDuration: "300ms" });
// @ts-expect-error a gesture waits for gestures, not for elements.
waitFor(fling, ["view"]);
