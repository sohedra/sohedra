// `@sohedra/lynx/gesture`: Lynx's gestures, set on an element with `main-thread:gesture`. Each
// class takes one options object, and its callbacks are main-thread functions:
//
//   const pan = $derived(new PanGesture({ minDistance: 4, onUpdate }));
//   <view main-thread:gesture={pan}></view>
//
// A gesture works from the first frame, and hydration keeps a drag that began before it; so does a
// rebuild that changes only the callbacks or what they captured (see `PanGesture`). The
// gestures and calls no device has shown working yet are in `@sohedra/lynx/experimental`.

export { DefaultScrollGesture, PanGesture, TapGesture } from "./gestures.ts";
export type {
	ContinuousGestureCallbacks,
	DefaultScrollGestureOptions,
	GestureCallbacks,
	GestureKind,
	GestureRelations,
	PanGestureOptions,
	TapGestureOptions,
} from "./gestures.ts";
export type {
	DefaultScrollGestureChangeEvent,
	DeltaParams,
	GestureCallback,
	GestureChangeEvent,
	GestureElement,
	GestureParams,
	PanGestureChangeEvent,
	ScrollParams,
	StateManager,
	TapGestureChangeEvent,
} from "./types.ts";
