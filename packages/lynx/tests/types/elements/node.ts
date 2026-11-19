// Checked by `pnpm check`, not run. A Lynx node as a component gets it: the DOM's tree questions,
// answered at once; listeners typed by the event's name; the element's UI methods, typed as Lynx's
// types give them; and animations.

import type { LynxAnimation, LynxNode, LynxScrollEvent } from "@sohedra/lynx/elements";

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_Ok extends true>(): void => {};

declare const view: LynxNode<"view">;
declare const scroller: LynxNode<"scroll-view">;
declare const field: LynxNode<"input">;
declare const root: LynxNode<"page">;
declare const any: LynxNode;

// Any tag is a node.
const nodes: LynxNode[] = [view, scroller, field, root];
void nodes;

// The tree questions.
const inside: boolean = view.contains(any);
const order: number = view.compareOrder(any);
const parent: LynxNode | null = view.parentElement;
const connected: boolean = view.isConnected;
const tag: "view" = view.tag;
const dataset: Record<string, unknown> = view.dataset;
void [inside, order, parent, connected, tag, dataset, root.contains(view), view.contains(null)];
nodes.sort((a, b) => a.compareOrder(b));
// @ts-expect-error contains takes a node, or nothing.
view.contains("view");
// @ts-expect-error compareOrder takes a node.
view.compareOrder(null);
// @ts-expect-error the tree is read-only.
view.isConnected = true;
// @ts-expect-error the tree is read-only.
view.parentElement = null;

// Listeners, typed by the event's name; an event the types do not name gets a `LynxEvent`.
view.addEventListener("tap", (event) => {
	assertType<Equal<typeof event.currentTarget, LynxNode<"view">>>();
	void event.touches.length;
});
scroller.addEventListener("scroll", (event) => void event.detail.scrollTop, { capture: true });
const listener = (event: LynxScrollEvent) => void event.detail.scrollLeft;
scroller.addEventListener("scroll", listener);
scroller.removeEventListener("scroll", listener);
view.addEventListener("myevent", (event) => void event.detail);
view.dispatchEvent({ type: "tap" });
// @ts-expect-error a tap is not a scroll.
view.addEventListener("tap", (event: LynxScrollEvent) => void event);
// @ts-expect-error an event's type is text.
view.addEventListener("tap", (event: { type: number }) => void event);

interface Rect {
	id: string;
	dataset: object;
	left: number;
	right: number;
	top: number;
	bottom: number;
	width: number;
	height: number;
}

export async function methods(): Promise<void> {
	// What a method resolves with is what Lynx's types give its `success`.
	const rect = await view.invoke("boundingClientRect");
	assertType<Equal<typeof rect, Rect>>();
	const anyRect = await any.invoke("boundingClientRect", { relativeTo: "screen" });
	assertType<Equal<typeof anyRect, Rect>>();
	const shot = await view.invoke("takeScreenshot", { format: "png" });
	assertType<Equal<typeof shot, { data: string }>>();
	const info = await scroller.invoke("getScrollInfo");
	const scrollX: number = info.scrollX;
	void scrollX;
	// A method Lynx declares no result for, or does not know, resolves with `unknown`.
	const focused = await view.invoke("setFocus", { focus: true });
	assertType<Equal<typeof focused, unknown>>();
	const custom = await view.invoke("myOwnMethod", { anything: 1 });
	assertType<Equal<typeof custom, unknown>>();
	await field.invoke("setValue", { value: "a" });
	await scroller.invoke("scrollTo", { offset: 0, smooth: true });
	await view.invoke("requestAccessibilityFocus");
}

// `params` may be left out only when Lynx's has no required field.
void view.invoke("boundingClientRect", {});
// @ts-expect-error setFocus needs `focus`.
void view.invoke("setFocus");
// @ts-expect-error setFocus needs `focus`.
void view.invoke("setFocus", {});
// @ts-expect-error `focus` is a boolean.
void view.invoke("setFocus", { focus: "yes" });
// @ts-expect-error takeScreenshot needs `format`.
void view.invoke("takeScreenshot");
// @ts-expect-error `format` is jpeg or png.
void view.invoke("takeScreenshot", { format: "gif" });
// @ts-expect-error autoScroll needs `rate` and `start`.
void scroller.invoke("autoScroll");
// @ts-expect-error a `<view>` has no setValue: it is an input's.
void view.invoke("setValue", { value: "a" });

// Animations.
const animation: LynxAnimation<LynxNode<"view">> = view.animate([{ opacity: 0 }, { opacity: 1 }], {
	duration: 300,
	iterations: Infinity,
	fill: "both",
});
animation.pause();
animation.play();
void animation.finished.then(() => animation.cancel());
view.animate([{ opacity: 0 }], 200);
// @ts-expect-error `play-state` is not sent to Lynx: use `pause()` and `play()`.
view.animate([{ opacity: 0 }], { duration: 300, "play-state": "paused" });
