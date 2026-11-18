// `@sohedra/lynx/experimental`: what has no device probe yet: the gestures of
// `@sohedra/lynx/gesture` besides the stable ones, their compositions, `continueWith`, and the
// state manager's `consumeGesture` and `interceptGesture`. Each has a test on both threads of the
// engine fake, and moves to its stable entry once a device probe shows it.

export {
	continueWith,
	ExclusiveGesture,
	RaceGesture,
	SimultaneousGesture,
} from "./compositions.ts";
export { FlingGesture, LongPressGesture, NativeGesture } from "./gestures.ts";
export type {
	FlingGestureOptions,
	LongPressGestureOptions,
	NativeGestureOptions,
} from "./gestures.ts";
export type {
	ExperimentalStateManager,
	FlingGestureChangeEvent,
	LongPressGestureChangeEvent,
	NativeGestureChangeEvent,
} from "./types.ts";
