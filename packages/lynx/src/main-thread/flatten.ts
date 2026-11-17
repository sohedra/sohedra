// Flattening. Lynx flattens a plain `<view>` into its parent's drawing: it then has no view of its
// own, and a UI method or an animation on it fails ("no UI for this node", code 6). So an element
// that the background calls a method on, or animates, is kept from being flattened, for good:
// `flatten` is false from then on. Lynx makes the view at the next flush of the tree. The app's own
// `flatten` is kept, and applies while the element is not held.

import { mainThread } from "./globals.ts";
import type { LynxElement } from "./globals.ts";

/** The elements of a page that are kept from being flattened. */
export interface Flattening {
	/** The app sets `flatten`: it applies now, unless the element is held. */
	set(element: LynxElement, value: unknown): void;
	/** Keeps the element from being flattened: Lynx makes its view at the next flush. */
	hold(element: LynxElement): void;
}

/** The flattening of one page's elements. */
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
