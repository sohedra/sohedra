// FloatingTree and its lookups: the open descendants and the ancestors of a node.
import { describe, expect, it } from "vitest";

import { FloatingTree } from "../../../src/foundation/popup/index.js";
import {
	getNodeAncestors,
	getNodeChildren,
} from "../../../src/foundation/popup/popup-floating-tree.js";
import { floatingNode as node } from "../../kit/kit-floating-tree.js";

describe("getNodeChildren and getNodeAncestors", () => {
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
