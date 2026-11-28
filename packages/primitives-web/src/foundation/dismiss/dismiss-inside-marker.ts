// The markers that tell a popup a press passed through a portal nested in it: a popup's Portal part
// attaches them, and the dismissal reads them.

import { Timeout } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type {
	PopupNode,
	PopupTree,
	PopupView,
} from "@sohedra/primitives-core/foundation/popup/index.js";
import type { Attachment } from "svelte/attachments";

import { webScheduler, type WebTypes } from "../kernel/index.js";

/** The events a press passes through, from its start to its click (and a touch's moves and end). */
export const PRESS_EVENTS = [
	"click",
	"mousedown",
	"pointerdown",
	"mouseup",
	"touchend",
	"touchmove",
] as const;

/**
 * Marks `nodes` in their tree as pressed inside on every press passing through the element, until
 * the next task.
 */
function attachInsideMarker(
	getNodes: () => { tree: PopupTree<WebTypes> | null; nodes: PopupNode<WebTypes>[] },
): Attachment<HTMLElement> {
	return (element) => {
		const clearTimeout = new Timeout(webScheduler);
		const mark = () => {
			const { tree, nodes } = getNodes();
			for (const node of nodes) {
				if (node.context) {
					tree?.markInside(node.id);
				}
			}
			clearTimeout.start(0, () => {
				for (const node of nodes) {
					if (node.context) {
						tree?.clearInside(node.id);
					}
				}
			});
		};
		for (const type of PRESS_EVENTS) {
			element.addEventListener(type, mark, true);
		}
		return () => {
			for (const type of PRESS_EVENTS) {
				element.removeEventListener(type, mark, true);
			}
			clearTimeout.clear();
		};
	};
}

/**
 * On a popup's Portal element: a press anywhere in the portal (the popup, but also a backdrop or a
 * viewport beside it) marks the popup's ancestors in the popup tree as pressed inside until the
 * next task, so a parent popup doesn't take it for an outside press. A portal moves the popup out
 * of its parent's element, so the parent can't see the press pass through itself. The popup
 * itself isn't marked: a press on its own backdrop still dismisses it.
 */
export function attachAncestorsInsideMarker(popup: PopupView<WebTypes>): Attachment<HTMLElement> {
	return attachInsideMarker(() => {
		const tree = popup.tree;
		return { tree, nodes: tree ? tree.ancestors(popup.nodeId) : [] };
	});
}
