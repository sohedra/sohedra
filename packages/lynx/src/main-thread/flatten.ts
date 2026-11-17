// Flattening. Lynx draws a plain `<view>` into its parent (flattening, on Android), or only lays it
// out when it has no attribute and no event (layout only): either way it has no view of its own, and
// a UI method or an animation on it fails ("no UI for this node", code 6). So an element that the
// background calls a method on, or animates, gets `flatten` false, for good, which ends both: Lynx
// makes its view at the next flush of the tree. The app's own `flatten` is kept, and applies while
// the element is not held.

import { mainThread } from "./globals.ts";
import type { LynxElement } from "./globals.ts";

/** The elements of a page that are kept from being flattened. */
export interface Flattening {
	/** The app sets `flatten`: it applies now, unless the element is held. */
	set(element: LynxElement, value: unknown): void;
	/** Keeps the element from being flattened: Lynx makes its view at the next flush. */
	hold(element: LynxElement): void;
}

/**
 * The flattening of one page's elements.
 *
 * @workaround view-for-called-element kind=lynx-limit delete-when="Lynx gives an element a view when a UI method or an animation needs one"
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
