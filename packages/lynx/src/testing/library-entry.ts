// `@sohedra/lynx/testing`: component tests without a phone, in the shape of
// `@testing-library/svelte`, on both of Lynx's threads. A test renders a component, finds its
// elements with the queries of `@testing-library/dom`, fires Lynx's events on them and reads the
// page again:
//
//   await render(Counter, { props: { start: 1 } });
//   await fireEvent.tap(screen.getByText("Tap me"));
//   expect(screen.getByText("Taps: 2")).toBeTruthy();
//
// What crosses between the threads arrives on a later task, so `render`, `fireEvent`, `act`,
// `rerender` and what `lynx` sends are awaited. The test presets (`@sohedra/lynx/config/rstest`,
// `@sohedra/lynx/config/vitest`) compile components as a Lynx build does, set up jsdom and clean up
// after each test.

export * from "@testing-library/dom";
export { cleanup } from "./cleanup.ts";
export { act } from "./library/act.ts";
export { fireEvent } from "./library/fire-event.ts";
export type { FireEvent, LynxEventInit, LynxEventName } from "./library/fire-event.ts";
export { render } from "./library/render.ts";
export type { LynxRenderOptions, RenderOptions, RenderResult } from "./library/render.ts";
export type {
	Invocation,
	InvokeHandler,
	LynxTestElement,
	TestGesture,
	TestGestureEvent,
	TestGestureKind,
	TestList,
	TestLynx,
	TestRect,
} from "./library/test-lynx.ts";
export type { InvokeResult } from "./engine/types.ts";
