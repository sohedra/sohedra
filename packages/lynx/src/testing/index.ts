// The test library: a faithful Lynx on a DOM, for the binding's tests and for apps.

export { cleanup } from "./cleanup.ts";
export { createEngine } from "./engine/create-engine.ts";
export type { ElementFunctions, Engine, EngineOptions } from "./engine/create-engine.ts";
export type { AnimationEvent, EngineEvent } from "./engine/dispatch.ts";
export type { GestureCall } from "./engine/gestures.ts";
export type { Lifecycle, LifecycleEvent, LifecycleProxy } from "./engine/lifecycle.ts";
export type { ListHandle } from "./engine/lists.ts";
export type {
	AnimationLog,
	BackgroundEventLog,
	BindingLog,
	Detector,
	ElementState,
	GestureCallLog,
	InvocationLog,
	ManagerCallLog,
	Responder,
	RunLog,
} from "./engine/state.ts";
export type {
	ComponentAtIndex,
	ComponentAtIndexes,
	EnqueueComponent,
	GestureCallback,
	GestureConfig,
	GestureRelations,
	InvokeResult,
	ListenerFunction,
	ListenerOptions,
	ListUpdate,
	LynxElement,
} from "./engine/types.ts";
export { startTestPage } from "./page/page.ts";
export type { TestPage, TestPageOptions } from "./page/page.ts";
export type {
	BackgroundLynx,
	MainThreadLynx,
	NativeApp,
	TestApp,
	ThreadContext,
	ThreadMessage,
} from "./page/lynx.ts";
