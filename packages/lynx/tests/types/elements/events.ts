// Checked by `pnpm check`, not run. An element's events, in the binding's four spellings and the
// same four after `main-thread:`: a background handler gets a copy of the event, whose
// `currentTarget` is the element's node; a main-thread function gets Lynx's own event, which it can
// stop.

import type {
	LynxEvent,
	LynxNode,
	LynxScrollEvent,
	LynxTouchEvent,
	MainThread,
	MainThreadEvent,
} from "@sohedra/lynx/elements";

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_Ok extends true>(): void => {};

const element = svelteLynx.createElement;

element("view", {
	ontap: (event) => {
		assertType<Equal<typeof event.currentTarget, LynxNode<"view">>>();
		assertType<Equal<typeof event.target, LynxNode>>();
		const x: number = event.detail.x;
		const touches: number = event.touches.length;
		const type: string = event.type;
		void [x, touches, type];
		// @ts-expect-error a background handler's event is a copy, with no functions: catch it with
		// `oncatchtap` instead.
		event.stopPropagation();
	},
	ontapcapture: (event) => void event.detail.y,
	oncatchtap: (event) => void event.touches,
	oncatchtapcapture: (event) => void event.changedTouches,
	onlayoutchange: (event) => void event.detail,
	"main-thread:ontap": (event) => {
		assertType<Equal<typeof event.currentTarget, MainThread.Element>>();
		event.currentTarget.setStyleProperty("opacity", "0.5");
		event.stopPropagation();
		event.stopImmediatePropagation();
		// @ts-expect-error Lynx's main-thread event has no `preventDefault`.
		event.preventDefault();
	},
	"main-thread:ontouchmovecapture": (event) => void event.detail.x,
	"main-thread:oncatchtouchend": (event) => void event.touches,
	"main-thread:oncatchtouchstartcapture": (event) => void event.changedTouches,
});

// An element's own events, with its own event types.
element("scroll-view", {
	onscroll: (event) => {
		const top: number = event.detail.scrollTop;
		assertType<Equal<typeof event.currentTarget, LynxNode<"scroll-view">>>();
		void top;
	},
});
element("input", { oninput: (event) => void event.detail.value.length });
element("overlay", {
	ononRequestClose: (event: LynxEvent) => void event,
	onrequestclose: () => {},
});

// A handler typed by hand, with the event types the elements entry exports.
const tapped = (event: LynxTouchEvent) => void event.detail.x;
const moved = (event: MainThreadEvent<LynxTouchEvent<MainThread.Element>>) =>
	event.stopPropagation();
element("text", { ontap: tapped, "main-thread:ontouchmove": moved });

// @ts-expect-error Lynx's own spelling is not the binding's: `ontap`.
element("view", { bindtap: () => {} });
// @ts-expect-error nor is `catchtap`: `oncatchtap`.
element("view", { catchtap: () => {} });
// @ts-expect-error capture comes after the name: `ontapcapture`.
element("view", { oncapturetap: () => {} });
// @ts-expect-error `global-bindtap` is `on(root, …)`.
element("view", { "global-bindtap": () => {} });
// @ts-expect-error a scroll handler does not take a tap.
element("view", { ontap: (event: LynxScrollEvent) => void event });
// @ts-expect-error a `<view>` sends no `scroll`.
element("view", { onscroll: () => {} });

// Lynx's types give an image's `load` and `error` an event as their detail: the detail has its
// fields, not an event's.
element("image", {
	onload: (event) => {
		// @ts-expect-error the detail is not an event: it has no functions.
		event.detail.preventDefault();
		// @ts-expect-error nor targets.
		void event.detail.target;
	},
	onerror: (event) => {
		const message: string = event.detail.errMsg;
		void message;
		// @ts-expect-error the detail is not an event.
		void event.detail.currentTarget;
	},
});
