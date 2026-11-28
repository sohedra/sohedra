// Nodes of a floating tree for core tests: `floatingNode(id, parentId, open, escapeKey)`.
import type { FloatingNode } from "../../src/foundation/popup/index.js";

/**
 * A node of a floating tree: open or closed, letting Escape bubble to its ancestors when
 * `escapeKey`, and outside presses always.
 */
export function floatingNode(
	id: string,
	parentId: string | null,
	open: boolean,
	escapeKey = false,
): FloatingNode {
	return {
		id,
		parentId,
		context: {
			open,
			floatingElement: null,
			anchorElement: null,
			dismissBubbles: { escapeKey, outsidePress: true },
			data: { insideTree: false },
		},
	};
}
