// The web's DOM globals, which neither of Lynx's threads ever has: Lynx draws native views, with no
// document. The names are the DOM's globals as TypeScript's `lib.dom.d.ts` declares them, the ones
// an app reaches for; the web's globals that `@sohedra/lynx-polyfill` fills, or that the wire's
// table says Lynx lacks for good (`matchMedia`, `localStorage`), are not repeated here.

import { PAGE_EVENTS, SCREEN_SIZE } from "../diagnostics/catalogue-checks.ts";

/** What a group of the DOM's globals is replaced by on Lynx. */
type DomInstead = "element" | "screen" | "layout" | "visibility" | "address";

/** What to use instead, by group. */
export const DOM_INSTEAD: Readonly<Record<DomInstead, string>> = {
	element:
		"Reach an element with `{@attach}` on the background, or with `main-thread:ref` in a main-thread function, and use its methods.",
	screen: `${SCREEN_SIZE} ${PAGE_EVENTS}`,
	layout: "Listen to the element's `layoutchange` event, which gives its size and place.",
	visibility:
		"Use the element's `onuiappear` and `onuidisappear` events, or `lynx.createIntersectionObserver({})` on the background.",
	address: "Keep where the app is in its own state: a Lynx page has no address.",
};

/** The DOM's globals, by group. */
const DOM_GLOBALS: Readonly<Record<string, DomInstead>> = {
	document: "element",
	Node: "element",
	Element: "element",
	HTMLElement: "element",
	SVGElement: "element",
	DocumentFragment: "element",
	ShadowRoot: "element",
	Range: "element",
	Selection: "element",
	getSelection: "element",
	getComputedStyle: "element",
	customElements: "element",
	MutationObserver: "element",
	DOMParser: "element",
	XMLSerializer: "element",
	window: "screen",
	innerWidth: "screen",
	innerHeight: "screen",
	outerWidth: "screen",
	outerHeight: "screen",
	devicePixelRatio: "screen",
	screen: "screen",
	visualViewport: "screen",
	scrollX: "screen",
	scrollY: "screen",
	scrollTo: "screen",
	scrollBy: "screen",
	ResizeObserver: "layout",
	IntersectionObserver: "visibility",
	location: "address",
	history: "address",
};

/** An element's class of the DOM, such as `HTMLDivElement` or `SVGPathElement`. */
const ELEMENT_CLASS = /^(?:HTML|SVG)\w*Element$/;

/** The group of the DOM global `name`, or `undefined` when it is not one. */
export function domGlobal(name: string): DomInstead | undefined {
	if (Object.prototype.hasOwnProperty.call(DOM_GLOBALS, name)) return DOM_GLOBALS[name];
	return ELEMENT_CLASS.test(name) ? "element" : undefined;
}

/** Every DOM global named here, for the test that keeps them apart from the wire's table. */
export const DOM_GLOBAL_NAMES: readonly string[] = Object.keys(DOM_GLOBALS);
