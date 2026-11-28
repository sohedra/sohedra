// The dismiss rules as facts in and an outcome out: the bubbling answers, the press type per
// pointer, which outside press dismisses, which popup answers Escape in a tree, a click after an
// earlier press, a touch's moves, and the end of a press that began inside.
import { describe, expect, it } from "vitest";

import {
	hasBlockingChild,
	isIgnoredOutsidePress,
	isTrailingClick,
	normalizeBubbles,
	pressEndOutcome,
	resolvePressType,
	touchMoveOutcome,
} from "../../../src/foundation/dismiss/dismiss-rules.js";
import { FloatingTree } from "../../../src/foundation/popup/index.js";
import { floatingNode as node } from "../../kit/kit-floating-tree.js";

describe("normalizeBubbles", () => {
	it("normalizes bubbles", () => {
		expect(normalizeBubbles(undefined)).toEqual({ escapeKey: false, outsidePress: true });
		expect(normalizeBubbles(true)).toEqual({ escapeKey: true, outsidePress: true });
		expect(normalizeBubbles({ escapeKey: true })).toEqual({ escapeKey: true, outsidePress: true });
	});
});

describe("resolvePressType", () => {
	it("resolves the press type per pointer type", () => {
		const option = { mouse: "intentional" as const, touch: "sloppy" as const };
		expect(resolvePressType("mouse", option)).toBe("intentional");
		expect(resolvePressType("pen", option)).toBe("intentional");
		expect(resolvePressType("", option)).toBe("intentional");
		expect(resolvePressType("touch", option)).toBe("sloppy");
		expect(resolvePressType("touch", "intentional")).toBe("intentional");
	});
});

describe("isIgnoredOutsidePress", () => {
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

describe("hasBlockingChild", () => {
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

describe("isTrailingClick", () => {
	it("counts a click as the tail of an earlier press only when no press was seen while open", () => {
		expect(isTrailingClick(true, false)).toBe(true);
		expect(isTrailingClick(true, true)).toBe(false);
		// A click with no press behind it is always its own press.
		expect(isTrailingClick(false, false)).toBe(false);
	});
});

describe("touchMoveOutcome", () => {
	it("lets a touch dismiss on its end once it moved, and at once when it moved far", () => {
		expect(touchMoveOutcome(10, 10, 14, 10)).toBe("none");
		expect(touchMoveOutcome(10, 10, 16, 10)).toBe("dismiss-on-end");
		expect(touchMoveOutcome(10, 10, 10, 20)).toBe("dismiss-on-end");
		expect(touchMoveOutcome(10, 10, 22, 10)).toBe("dismiss");
		// The distance, not one axis: 8 across and 8 down is more than 10 away.
		expect(touchMoveOutcome(10, 10, 18, 18)).toBe("dismiss");
	});
});

describe("pressEndOutcome", () => {
	it("decides what the end of a press that began inside means for the next click", () => {
		const end = { pressType: "intentional", canceled: false, startPrevented: false } as const;
		expect(pressEndOutcome({ ...end, endedInTree: true })).toBe("none");
		expect(pressEndOutcome({ ...end, endedInTree: false })).toBe("suppress-next");
		expect(pressEndOutcome({ ...end, startPrevented: true, endedInTree: false })).toBe(
			"suppress-immediate",
		);
		expect(pressEndOutcome({ ...end, canceled: true, endedInTree: false })).toBe("none");
		expect(
			pressEndOutcome({ ...end, canceled: true, startPrevented: true, endedInTree: false }),
		).toBe("suppress-immediate");
		expect(pressEndOutcome({ ...end, pressType: "sloppy", endedInTree: false })).toBe("none");
	});
});
