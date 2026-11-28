// The hover and safe-polygon cases. The floating-tree, dismiss and trigger-map cases are in
// ../popup/popup-floating-tree.test.ts, ../dismiss/dismiss.policy.test.ts and
// ../popup/popup-trigger-map.test.ts.

import { describe, expect, it } from "vitest";

import { SafePolygon } from "../../../src/foundation/hover/hover-intent.js";
import { getDelay, isClickLikeOpenEvent } from "../../../src/foundation/hover/hover-rules.js";
import {
	isPointInQuadrilateral,
	type Box,
} from "../../../src/foundation/hover/hover-safe-polygon-rules.js";
import { isHoverOpenEvent } from "../../../src/foundation/hover/index.js";

describe("hover intent", () => {
	it("resolves delays, with no delay for touch", () => {
		expect(getDelay(100, "open")).toBe(100);
		expect(getDelay({ close: 50 }, "close", "mouse")).toBe(50);
		expect(getDelay({ close: 50 }, "open")).toBeUndefined();
		expect(getDelay(100, "open", "touch")).toBe(0);
	});

	it("tells click and hover opens apart", () => {
		expect(isClickLikeOpenEvent("click", false)).toBe(true);
		expect(isClickLikeOpenEvent("mouseenter", true)).toBe(true);
		expect(isHoverOpenEvent("mouseenter")).toBe(true);
		expect(isHoverOpenEvent("mousemove")).toBe(true);
		for (const type of ["mousedown", "click", "keydown", "imperative-action", undefined] as const) {
			expect(isHoverOpenEvent(type)).toBe(false);
		}
	});
});

const box = (left: number, top: number, width: number, height: number): Box => ({
	left,
	top,
	width,
	height,
	right: left + width,
	bottom: top + height,
});

describe("safe polygon", () => {
	it("tests points against a quadrilateral", () => {
		expect(isPointInQuadrilateral(5, 5, 0, 0, 10, 0, 10, 10, 0, 10)).toBe(true);
		expect(isPointInQuadrilateral(15, 5, 0, 0, 10, 0, 10, 10, 0, 10)).toBe(false);
	});

	// Trigger at 100,100 (100×20); popup below it at 50,130 (200×100), a 10px gap.
	const measure = () => ({ reference: box(100, 100, 100, 20), floating: box(50, 130, 200, 100) });
	const input = (clientX: number, clientY: number, overrides = {}) => ({
		clientX,
		clientY,
		isLeave: false,
		isOverFloating: false,
		isOverReference: false,
		leavingIntoFloating: false,
		hasOpenChild: false,
		measure,
		now: 0,
		...overrides,
	});

	it("stays open in the trough between trigger and popup", () => {
		const polygon = new SafePolygon("bottom", 150, 120, 0);
		expect(polygon.decide(input(150, 125, { now: 10 }))).toBe("stay");
	});

	it("closes when leaving away from the popup", () => {
		const polygon = new SafePolygon("bottom", 150, 100, 0);
		expect(polygon.decide(input(150, 90, { isLeave: true }))).toBe("close");
	});

	it("waits for the pointer inside the triangle, and stays once landed", () => {
		const polygon = new SafePolygon("bottom", 150, 121, 0);
		expect(polygon.decide(input(95, 128, { now: 1 }))).toBe("close-soon");
		expect(polygon.decide(input(95, 140, { isOverFloating: true, now: 2 }))).toBe("stay");
	});

	it("stays open while a nested child is open", () => {
		const polygon = new SafePolygon("bottom", 150, 121, 0);
		expect(polygon.decide(input(400, 400, { hasOpenChild: true }))).toBe("stay");
	});
});
