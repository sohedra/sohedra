// `@sohedra/lynx/experimental`: what works on the engine fake but no device has shown working
// yet: the gestures of `@sohedra/lynx/gesture` besides the tested ones, their compositions,
// `continueWith`, and the state manager's `consumeGesture` and `interceptGesture`. Each moves to
// its stable entry once a device probe shows it.

export {
	continueWith,
	ExclusiveGesture,
	FlingGesture,
	LongPressGesture,
	NativeGesture,
	RaceGesture,
	SimultaneousGesture,
} from "./gestures.ts";
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
