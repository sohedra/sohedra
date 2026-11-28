// The floating tree's own case: it finds open descendants and ancestors.

import { describe, expect, it } from "vitest";

import { type FloatingNode, FloatingTree } from "../../../src/foundation/popup/index.js";
import {
	getNodeAncestors,
	getNodeChildren,
} from "../../../src/foundation/popup/popup-floating-tree.js";

function node(id: string, parentId: string | null, open: boolean, escapeKey = false): FloatingNode {
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

describe("floating tree", () => {
	it("finds open descendants and ancestors", () => {
		const tree = new FloatingTree();
		const nodes = [
			node("a", null, true),
			node("b", "a", true),
			node("c", "b", false),
			node("d", "c", true),
		];
		nodes.forEach((n) => tree.addNode(n));
		expect(getNodeChildren(tree.nodes, "a").map((n) => n.id)).toEqual(["b", "d"]);
		expect(getNodeChildren(tree.nodes, "a", false).map((n) => n.id)).toEqual(["b", "c", "d"]);
		expect(getNodeAncestors(tree.nodes, "d").map((n) => n.id)).toEqual(["c", "b", "a"]);
		tree.removeNode(nodes[1]);
		expect(getNodeChildren(tree.nodes, "a")).toEqual([]);
	});
});
