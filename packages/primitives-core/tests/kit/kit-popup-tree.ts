// Nodes of a popup tree for core tests: `popupNode(id, parentId, open, escapeKey)`.
import type { PopupNode } from "../../src/foundation/popup/index.js";

/**
 * A node of a popup tree: open or closed, letting Escape bubble to its ancestors when
 * `escapeKey`, and outside presses always.
 */
export function popupNode(
	id: string,
	parentId: string | null,
	open: boolean,
	escapeKey = false,
): PopupNode {
	return {
		id,
		parentId,
		context: {
			open,
			positionerElement: null,
			anchorElement: null,
			dismissBubbles: { escapeKey, outsidePress: true },
		},
	};
}
