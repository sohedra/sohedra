// Checked by `pnpm check`, not run. Svelte's `on()` with a Lynx node: the event is the one the
// element sends by that name, with the node as `currentTarget`. The app fixture checks the same
// without the DOM lib (tests/fixtures/types/app/src/on.ts), where Svelte's own overloads take
// anything.

import { root } from "@sohedra/lynx";
import type { LynxEvent, LynxNode, LynxTouchEvent } from "@sohedra/lynx/elements";
import { on } from "svelte/events";

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_Ok extends true>(): void => {};

declare const view: LynxNode<"view">;
declare const scroller: LynxNode<"scroll-view">;

const off: () => void = on(view, "tap", (event) => {
	assertType<Equal<typeof event, LynxTouchEvent<LynxNode, LynxNode<"view">>>>();
});
off();
on(scroller, "scroll", (event) => void event.detail.scrollTop, { capture: true });
on(root, "touchstart", (event) => {
	assertType<Equal<typeof event.currentTarget, LynxNode<"page">>>();
});
on(view, "catchtap", (event) => {
	assertType<Equal<typeof event, LynxEvent<LynxNode, LynxNode<"view">>>>();
});

// @ts-expect-error a tap has no scroll detail.
on(view, "tap", (event: { detail: { scrollTop: number } }) => event);
// @ts-expect-error capture is a boolean.
on(view, "tap", () => {}, { capture: "yes" });
