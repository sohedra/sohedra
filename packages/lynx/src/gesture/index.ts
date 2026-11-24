// `@sohedra/lynx/gesture`: Lynx's gestures, set on an element with `main-thread:gesture`. Each
// class takes one options object, and its callbacks are main-thread functions:
//
//   const pan = $derived(new PanGesture({ minDistance: 4, onUpdate }));
//   <view main-thread:gesture={pan}></view>
//
// A gesture works from the first frame. Hydration keeps a drag that began before it when the
// background's gesture has the same type, options, relations and callback names; so does a rebuild
// that changes only the callbacks or what they captured (see `PanGesture`). This entry ran on an
// Android phone (Lynx 4.2); iOS is checked on an iPhone later, and what fails there moves to
// `@sohedra/lynx/experimental`, with the gestures and calls that wait for a device probe to pass.
// The relation options `waitFor` and `continueWith` are experimental (see `GestureRelations`).

export { DefaultScrollGesture, PanGesture, TapGesture } from "./gestures.ts";
export type {
	ContinuousGestureCallbacks,
	DefaultScrollGestureOptions,
	GestureCallbacks,
	GestureRelations,
	PanGestureOptions,
	TapGestureOptions,
} from "./gestures.ts";
export type { Gesture } from "./gesture.ts";
export type {
	DefaultScrollGestureChangeEvent,
	DeltaParams,
	GestureCallback,
	GestureChangeEvent,
	GestureParams,
	PanGestureChangeEvent,
	ScrollParams,
	StateManager,
	TapGestureChangeEvent,
} from "./types.ts";
