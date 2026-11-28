// The dismiss decisions, and the floating-tree case that asks which popup answers Escape. The
// tree's own case is in ../popup/popup-floating-tree.test.ts and the trigger-map cases in
// ../popup/popup-trigger-map.test.ts.

import { describe, expect, it } from "vitest";

import {
	hasBlockingChild,
	isIgnoredOutsidePress,
	normalizeBubbles,
	resolvePressType,
} from "../../../src/foundation/dismiss/dismiss-rules.js";
import { type FloatingNode, FloatingTree } from "../../../src/foundation/popup/index.js";

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
	it("lets only the innermost open popup handle Escape unless the child bubbles", () => {
		const tree = new FloatingTree();
		tree.addNode(node("parent", null, true));
		tree.addNode(node("child", "parent", true));
		expect(hasBlockingChild(tree, "parent", "escapeKey")).toBe(true);
		expect(hasBlockingChild(tree, "child", "escapeKey")).toBe(false);
		const bubbling = new FloatingTree();
		bubbling.addNode(node("parent", null, true));
		bubbling.addNode(node("child", "parent", true, true));
		expect(hasBlockingChild(bubbling, "parent", "escapeKey")).toBe(false);
	});
});

describe("dismiss policy", () => {
	it("normalizes bubbles", () => {
		expect(normalizeBubbles(undefined)).toEqual({ escapeKey: false, outsidePress: true });
		expect(normalizeBubbles(true)).toEqual({ escapeKey: true, outsidePress: true });
		expect(normalizeBubbles({ escapeKey: true })).toEqual({ escapeKey: true, outsidePress: true });
	});

	it("resolves the press type per pointer type", () => {
		const option = { mouse: "intentional" as const, touch: "sloppy" as const };
		expect(resolvePressType("mouse", option)).toBe("intentional");
		expect(resolvePressType("pen", option)).toBe("intentional");
		expect(resolvePressType("", option)).toBe("intentional");
		expect(resolvePressType("touch", option)).toBe("sloppy");
		expect(resolvePressType("touch", "intentional")).toBe("intentional");
	});

	it("dismisses intentional presses on click and sloppy ones on press", () => {
		expect(isIgnoredOutsidePress("click", "intentional")).toBe(false);
		// A press start: `mousedown`, or a native event core has no name for (web: `pointerdown`).
		expect(isIgnoredOutsidePress(undefined, "intentional")).toBe(true);
		expect(isIgnoredOutsidePress("mousedown", "intentional")).toBe(true);
		expect(isIgnoredOutsidePress("click", "sloppy")).toBe(true);
		expect(isIgnoredOutsidePress(undefined, "sloppy")).toBe(false);
		expect(isIgnoredOutsidePress("mousedown", "sloppy")).toBe(false);
	});
});
