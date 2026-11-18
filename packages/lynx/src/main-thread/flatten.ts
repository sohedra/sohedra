// Flattening and layout-only views. Lynx only lays out a `<view>` that has no attribute, no event
// and only layout styles (layout-only): it gets no UI at all, so a UI method or an animation on it
// fails ("no UI for this node", code 6) on iOS and Android. On Android, Lynx also draws a plain
// `<view>` into its parent (flattening); it keeps a UI, which lacks a full view's methods, such as
// `takeScreenshot`. So an element that the background calls a method on, or animates, gets
// `flatten` false, for good: as an attribute, it ends layout-only, and it also ends flattening.
// Lynx makes its UI at the next flush of the tree. The app's own `flatten` is kept, and applies
// while the element is not held.

import { mainThread } from "./globals.ts";
import type { LynxElement } from "./globals.ts";

/** The `flatten` of a page's elements, and the elements held so that Lynx gives them a UI. */
export interface Flattening {
	/** The app sets `flatten`: it applies now, unless the element is held. */
	set(element: LynxElement, value: unknown): void;
	/** Gives the element `flatten` false for good: Lynx makes its UI at the next flush. */
	hold(element: LynxElement): void;
}

/**
 * The `flatten` of one page's elements, and the hold that gives a called element a UI.
 *
 * @workaround view-for-called-element kind=lynx-limit delete-when="Lynx gives a layout-only view a UI when a UI method or an animation needs one"
 */
export function createFlattening(): Flattening {
	const held = new WeakSet<LynxElement>();
	const own = new WeakMap<LynxElement, unknown>();
	return {
		set(element, value) {
			own.set(element, value);
			if (!held.has(element)) mainThread.__SetAttribute(element, "flatten", value);
		},
		hold(element) {
			if (held.has(element)) return;
			held.add(element);
			mainThread.__SetAttribute(element, "flatten", false);
		},
	};
}
