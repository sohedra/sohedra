// Layout-only views. Lynx lays out a `<view>` that needs nothing drawn without giving it a UI at
// all: `ElementContainer::CreatePaintingNode` returns for it
// (core/renderer/dom/element_container.cc), so every UI method on it answers "no UI for this node"
// (code 6) on iOS and Android. A view is layout-only while it has had no attribute (an id counts),
// no event and no style that is not a layout one (core/renderer/dom/fiber/fiber_element.cc,
// Element::CanBeLayoutOnly and MarkHasLayoutOnlyPropsIfNecessary; core/renderer/dom/element.cc,
// SetEventHandler). Once one comes, Lynx makes its UI at the next flush, and keeps it.
//
// Seen on Lynx 4.2 on iOS and Android:
// - A custom property (`--x`) leaves a view layout-only, in the style text, added one by one or
//   set as an object: Lynx keeps it as a variable, not a style (fiber_element.cc,
//   Element::ParseRawInlineStyles; core/runtime/lepus/bindings/renderer_functions.cc,
//   FiberSetInlineStyles), and `__AddInlineStyle` finds no style by its name
//   (core/renderer/css/css_property.cc, GetPropertyID). So a component's `--x` wrapper has no UI.
// - A view put straight in a scroll view always has a UI, and keeps that once taken out
//   (core/renderer/dom/fiber/scroll_element.cc, ScrollElement::OnNodeAdded). Only
//   `__CreateScrollView` makes a scroll element; `__CreateElement("scroll-view")` makes a plain one
//   (core/renderer/dom/element_manager.cc, CreateFiberScrollView and CreateFiberNode).
// - A class, matched by the page's style sheet or not, an empty class text and an empty dataset
//   leave a view layout-only. An id of none gives it a UI (properties.ts, `__SetID`).
//
// The fake has no style sheet, so a class whose styles are not layout ones gives no UI here, where
// a device has one: the stricter side. A gesture detector counts as an event, which is not
// verified.

import type { ElementState } from "./state.ts";

/**
 * The styles that leave a view layout-only: those Lynx marks LAYOUT_ONLY
 * (core/renderer/css/layout_property.h), and `overflow` when it is visible.
 */
const LAYOUT_STYLES = new Set([
	"align-content",
	"align-items",
	"align-self",
	"aspect-ratio",
	"bottom",
	"box-sizing",
	"column-gap",
	"content",
	"display",
	"flex",
	"flex-basis",
	"flex-direction",
	"flex-grow",
	"flex-shrink",
	"flex-wrap",
	"gap",
	"grid-auto-columns",
	"grid-auto-flow",
	"grid-auto-rows",
	"grid-column",
	"grid-column-end",
	"grid-column-gap",
	"grid-column-span",
	"grid-column-start",
	"grid-row",
	"grid-row-end",
	"grid-row-gap",
	"grid-row-span",
	"grid-row-start",
	"grid-template-columns",
	"grid-template-rows",
	"height",
	"justify-content",
	"justify-items",
	"justify-self",
	"left",
	"linear-cross-gravity",
	"linear-direction",
	"linear-gravity",
	"linear-layout-gravity",
	"linear-orientation",
	"linear-weight",
	"linear-weight-sum",
	"margin",
	"margin-bottom",
	"margin-left",
	"margin-right",
	"margin-top",
	"max-height",
	"max-width",
	"min-height",
	"min-width",
	"order",
	"padding",
	"padding-bottom",
	"padding-left",
	"padding-right",
	"padding-top",
	"relative-align-bottom",
	"relative-align-left",
	"relative-align-right",
	"relative-align-top",
	"relative-bottom-of",
	"relative-center",
	"relative-id",
	"relative-layout-once",
	"relative-left-of",
	"relative-right-of",
	"relative-top-of",
	"right",
	"row-gap",
	"top",
	"width",
]);

/**
 * Whether a style leaves a view layout-only. A custom property does; a fixed or sticky position
 * does not.
 */
function isLayoutStyle(name: string, value: string): boolean {
	if (name.startsWith("--")) return true;
	if (name === "overflow" || name === "overflow-x" || name === "overflow-y")
		return value === "visible";
	if (name === "position") return value !== "fixed" && value !== "sticky";
	return LAYOUT_STYLES.has(name);
}

/** Whether Lynx would lay the element out with no UI, as it is now. */
export function isLayoutOnly(state: ElementState): boolean {
	return (
		state.tag === "view" &&
		state.canBeLayoutOnly &&
		state.id === null &&
		Object.keys(state.attrs).length === 0 &&
		state.listeners.length === 0 &&
		state.mainThreadEvents.length === 0 &&
		state.handlers.length === 0 &&
		state.filedEvents.size === 0 &&
		state.detectors.size === 0 &&
		[...state.inlineStyles].every(([name, value]) => isLayoutStyle(name, value))
	);
}
