// `on()` from `svelte/events` on a Lynx node, without the DOM lib: the binding's overload types the
// event. Svelte's own overloads name DOM types, which are not found here, so they take anything:
// a wrong call is caught with the DOM lib only (tests/types/elements/on.ts).

import { root } from "@sohedra/lynx";
import type { LynxEvent, LynxNode, LynxScrollEvent, LynxTouchEvent } from "@sohedra/lynx/elements";
import { on } from "svelte/events";

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_Ok extends true>(): void => {};

export function listen(view: LynxNode<"view">, scroller: LynxNode<"scroll-view">): void {
	on(view, "tap", (event) => {
		assertType<Equal<typeof event, LynxTouchEvent<LynxNode, LynxNode<"view">>>>();
	});
	on(scroller, "scroll", (event) => {
		assertType<Equal<typeof event, LynxScrollEvent<LynxNode, LynxNode<"scroll-view">>>>();
	});
	on(root, "longpress", (event) => {
		assertType<Equal<typeof event.currentTarget, LynxNode<"page">>>();
	});
	on(view, "myevent", (event) => {
		assertType<Equal<typeof event, LynxEvent<LynxNode, LynxNode<"view">>>>();
	});
	view.addEventListener("tap", (event) => {
		assertType<Equal<typeof event.touches, LynxTouchEvent["touches"]>>();
	});
}
