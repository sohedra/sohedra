// A `<scroll-view>` draws every element in it in the first frame: on a mid-range Android phone, a
// row of a picture and four texts costs about 4.5 ms to the first paint and 0.4 MB, and the paint
// passes a second at about 200 rows. A development build warns once for each scroll view that holds
// more than that many elements directly, pointing to `<list>`, which makes its rows on demand.

import { sourceLocation } from "../../svelte/runtime/index.ts";
import { backgroundError } from "../catalogue.ts";
import { warnOnce } from "../report.ts";
import type { TreeNode } from "./node.ts";

/** How many elements a scroll view holds directly before the warning. */
const SCROLL_VIEW_ROWS = 200;

const warned = new WeakSet<TreeNode>();

/**
 * Counts the elements directly in `node`, up to one past `limit`. Svelte moves a fragment's nodes
 * into the element it is inserted in, so an `{#each}`'s rows are its children.
 */
function countElements(node: TreeNode, limit: number): number {
	let count = 0;
	for (let child = node.first; child && count <= limit; child = child.next)
		if (child.kind === "element" && child.lynxId !== 0) count++;
	return count;
}

/** Warns, once for the element, when `container` is a scroll view with too many elements in it. */
export function checkScrollViewRows(container: TreeNode): void {
	if (container.tag !== "scroll-view" || warned.has(container)) return;
	if (countElements(container, SCROLL_VIEW_ROWS) <= SCROLL_VIEW_ROWS) return;
	warned.add(container);
	const where = sourceLocation(container);
	warnOnce(`scroll_view_many_children:${where ?? container.lynxId}`, () =>
		backgroundError({
			code: "scroll_view_many_children",
			details: { limit: SCROLL_VIEW_ROWS, where },
		}),
	);
}
