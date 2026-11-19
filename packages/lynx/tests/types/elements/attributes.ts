// Checked by `pnpm check`, not run. What each element takes, through the call the Svelte language
// tools make of a component's markup (`svelteLynx.createElement`): Lynx's attributes, the
// binding's, Svelte's `class`, and nothing else.

import { mainThreadRef } from "@sohedra/lynx";
import type { LynxElements, MainThread } from "@sohedra/lynx/elements";
import { PanGesture } from "@sohedra/lynx/gesture";

const element = svelteLynx.createElement;

element("view", {
	class: ["card", { selected: true }, null],
	style: "padding: 8px",
	id: "card",
	"data-index": 3,
	flatten: false,
	"accessibility-label": "Card",
	"main-thread:gesture": new PanGesture({ minDistance: 4 }),
});
element("list", { "custom-list-name": "list-container", "scroll-orientation": "vertical" });
// A `<list-item>` in a keyed `{#each}` takes the block's key, so its `item-key` may be left out.
element("list-item", {});
element("list-item", { "item-key": "a", "reuse-identifier": "row", defer: true });
element("list-item", { defer: { unmountRecycled: true } });
element("input", { value: "typed", placeholder: "Name" });
element("textarea", { value: "typed" });
element("overlay", { visible: true, "events-pass-through": true, level: 2 });
element("raw-text", { text: "a" });
element("markdown", { content: "# Title" });
element("svelte:options", { runes: true });
element("svelte:boundary", { onerror: (error) => void error });
element("view", { [Symbol("@attach")]: (node) => void node.tag });

const ref = mainThreadRef<MainThread.Element | null>(null);
element("view", { "main-thread:ref": ref });
element("view", {
	"main-thread:ref": (node) => {
		node.setStyleProperty("opacity", "1");
		return () => node.setStyleProperty("opacity", "0");
	},
});

// @ts-expect-error `<div>` is not a Lynx element.
element("div", {});
// @ts-expect-error `<frame>` is left out until a device shows one drawn.
element("frame", {});
// @ts-expect-error a reuse identifier is text.
element("list-item", { "reuse-identifier": 1 });
// @ts-expect-error `text` is required on `<raw-text>`.
element("raw-text", {});
// @ts-expect-error `content` is required on `<markdown>`.
element("markdown", {});
// @ts-expect-error a `<view>` has no `src`.
element("view", { src: "a.png" });
// @ts-expect-error `style` is text, as Svelte writes it.
element("view", { style: { padding: 8 } });
// @ts-expect-error `className` is ReactLynx's: Svelte writes `class`.
element("view", { className: "card" });
// @ts-expect-error `defer` takes `unmountRecycled` and nothing else.
element("list-item", { defer: { recycle: true } });
// @ts-expect-error an input's value is text.
element("input", { value: 3 });
// @ts-expect-error a main-thread ref is a ref or a function, not a selector.
element("view", { "main-thread:ref": "box" });
// @ts-expect-error an object that only looks like a ref.
element("view", { "main-thread:ref": { current: null } });
// @ts-expect-error a main-thread function's element is a main-thread element, not a number.
element("view", { "main-thread:ref": (node: number) => void node });
// @ts-expect-error a gesture of @sohedra/lynx/gesture, not a plain object.
element("view", { "main-thread:gesture": { type: 0 } });
// @ts-expect-error `css` is not an option on Lynx.
element("svelte:options", { css: "injected" });
// @ts-expect-error each element's attributes are its own.
const image: LynxElements["image"] = { "scroll-orientation": "vertical" };
void image;
