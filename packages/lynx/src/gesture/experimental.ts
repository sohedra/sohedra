// `@sohedra/lynx/experimental`: what waits for a device probe to show it working: the gestures of
// `@sohedra/lynx/gesture` besides the stable ones, their compositions, `continueWith`, and the
// state manager's `consumeGesture` and `interceptGesture`. Each moves to its stable entry once a
// probe passes on iOS and Android.

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
