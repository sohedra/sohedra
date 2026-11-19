// Checked by `pnpm check`, not run. `@sohedra/lynx/testing`: `render` in the shape of
// `@testing-library/svelte`'s, with Lynx's knobs under `lynx`; the queries of
// `@testing-library/dom`; `fireEvent` and its shortcuts; and the Lynx a test drives.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@sohedra/lynx/testing";
import type {
	FireEvent,
	Invocation,
	InvokeHandler,
	LynxEventInit,
	LynxEventName,
	LynxTestElement,
	RenderOptions,
	RenderResult,
	TestGesture,
	TestLynx,
} from "@sohedra/lynx/testing";
import type { Component } from "svelte";

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_Ok extends true>(): void => {};

declare const Card: Component<{ title: string; count?: number }, { reset(): void }>;

export async function rendersACard(): Promise<void> {
	const options: RenderOptions<{ title: string; count?: number }> = {
		props: { title: "Hello" },
		context: new Map([["theme", "dark"]]),
		lynx: {
			initData: { route: "/" },
			globalProps: { theme: "dark" },
			systemInfo: { platform: "Android" },
			firstFrame: false,
			background: true,
		},
	};
	const result: RenderResult<{ reset(): void }, { title: string; count?: number }> = await render(
		Card,
		options,
	);
	assertType<Equal<typeof result.container, LynxTestElement>>();
	result.component.reset();
	await result.rerender({ count: 2 });
	// @ts-expect-error a prop the component does not take.
	await result.rerender({ size: 2 });
	result.getByText("Hello");
	result.debug();
	await result.unmount();

	const lynx: TestLynx = result.lynx;
	const answer: InvokeHandler = ({ method, params, element }) => {
		const call: Invocation = { method, params, element };
		return call.method === "boundingClientRect" ? { code: 0, data: { width: 1 } } : { code: 0 };
	};
	lynx.respondInvoke(answer);
	// @ts-expect-error the handler takes one object, not three arguments.
	lynx.respondInvoke((method: string, params: object) => ({
		code: method.length + Object.keys(params).length,
	}));
	const calls: readonly Invocation[] = lynx.invocations;
	void calls;
	lynx.setBoundingClientRect(result.container, { left: 0, top: 0, width: 10, height: 10 });
	lynx.list(result.container).show(0);
	const gesture: TestGesture = lynx.gesture(result.container, "pan");
	await gesture.fire("onUpdate", { params: { x: 1 }, timestamp: 16 });
	// @ts-expect-error a kind of gesture Lynx does not have.
	lynx.gesture(result.container, "swipe");
	await lynx.sendHostEvent("onWindowResize", [390, 844]);
	// @ts-expect-error the window's size is two numbers.
	await lynx.sendHostEvent("onWindowResize", ["wide"]);
	await lynx.sendHostEvent("appdefined", [{ any: "thing" }]);
	await lynx.updateGlobalProps({ theme: "light" });
	await lynx.updateInitData({ route: "/cart" });
	await lynx.reload();
	await lynx.reload({ route: "/" });

	// @ts-expect-error Lynx's knobs go under `lynx`, not beside the props.
	await render(Card, { props: { title: "x" }, initData: {} });
}

export async function firesEvents(element: HTMLElement): Promise<void> {
	const tapped: boolean = await fireEvent.tap(element);
	void tapped;
	const init: LynxEventInit = { detail: { value: "hi" }, bubbles: false };
	await fireEvent.input(element, init);
	await fireEvent(element, "snap", { detail: { position: 2 } });
	const name: LynxEventName = "scroll";
	const fire: FireEvent = fireEvent;
	await fire[name](element);
	// @ts-expect-error `tapp` is no shortcut.
	await fireEvent.tapp(element);
	await act(() => {});
	const value: number | undefined = await act(() => 1);
	void value;
	cleanup();
	await waitFor(() => screen.getByText("done"));
	within(element).queryByText("done");
}
