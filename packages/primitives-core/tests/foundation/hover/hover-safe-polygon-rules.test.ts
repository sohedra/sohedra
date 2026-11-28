// The safe polygon: a point in a quadrilateral, the pure step from one track and move to the next,
// and one hover-out's polygon deciding moves between a trigger and its popup on every side. A
// decision of `"close"` is a close at once, `"stay"` none, `"close-soon"` a close unless another
// move comes.
import { describe, expect, it } from "vitest";

import { SafePolygon } from "../../../src/foundation/hover/hover-intent.js";
import {
	decideSafePolygon,
	isPointInQuadrilateral,
	type SafePolygonInput,
	startSafePolygon,
} from "../../../src/foundation/hover/hover-safe-polygon-rules.js";
import { box } from "../../kit/kit-geometry.js";

// Trigger at 100,100 (100×20); popup below it at 50,130 (200×100), a 10px gap.
const move = (clientX: number, clientY: number, overrides = {}): SafePolygonInput => ({
	clientX,
	clientY,
	isLeave: false,
	isOverFloating: false,
	isOverReference: false,
	leavingIntoFloating: false,
	hasOpenChild: false,
	measure: () => ({ reference: box(100, 100, 100, 20), floating: box(50, 130, 200, 100) }),
	now: 0,
	...overrides,
});

/** A 100×100 trigger at the origin and a popup on `placement`, 20px away, with points to move to. */
function createPlacementScenario(placement: "top" | "bottom" | "left" | "right") {
	const referenceRect = box(0, 0, 100, 100);

	switch (placement) {
		case "top":
			return {
				referenceRect,
				floatingRect: box(0, -120, 100, 100),
				leavePoint: [50, 0] as const,
				troughPoint: [50, -10] as const,
				outsidePoint: [50, 150] as const,
			};
		case "bottom":
			return {
				referenceRect,
				floatingRect: box(0, 120, 100, 100),
				leavePoint: [50, 100] as const,
				troughPoint: [50, 110] as const,
				outsidePoint: [50, -50] as const,
			};
		case "left":
			return {
				referenceRect,
				floatingRect: box(-120, 0, 100, 100),
				leavePoint: [0, 50] as const,
				troughPoint: [-10, 50] as const,
				outsidePoint: [150, 50] as const,
			};
		case "right":
			return {
				referenceRect,
				floatingRect: box(120, 0, 100, 100),
				leavePoint: [100, 50] as const,
				troughPoint: [110, 50] as const,
				outsidePoint: [-50, 50] as const,
			};
	}
}

/** A pointer move over neither element. */
function createMouseMove(
	scenario: ReturnType<typeof createPlacementScenario>,
	clientX: number,
	clientY: number,
): SafePolygonInput {
	return {
		clientX,
		clientY,
		isLeave: false,
		isOverFloating: false,
		isOverReference: false,
		leavingIntoFloating: false,
		hasOpenChild: false,
		measure: () => ({ reference: scenario.referenceRect, floating: scenario.floatingRect }),
		now: 10,
	};
}

describe("isPointInQuadrilateral", () => {
	it("tests points against a quadrilateral", () => {
		expect(isPointInQuadrilateral(5, 5, 0, 0, 10, 0, 10, 10, 0, 10)).toBe(true);
		expect(isPointInQuadrilateral(15, 5, 0, 0, 10, 0, 10, 10, 0, 10)).toBe(false);
	});
});

describe("decideSafePolygon", () => {
	it("returns the next track and leaves the one it was given as it is", () => {
		const start = startSafePolygon("bottom", 150, 121, 0);
		const snapshot = { ...start };
		const first = decideSafePolygon(start, move(95, 128, { now: 1 }));
		expect(first.decision).toBe("close-soon");
		expect(start).toEqual(snapshot);
		expect(first.track).toMatchObject({ hasLanded: false, lastX: 95, lastY: 128, lastTime: 1 });

		const landed = decideSafePolygon(first.track, move(95, 140, { isOverFloating: true, now: 2 }));
		expect(landed.decision).toBe("stay");
		expect(landed.track.hasLanded).toBe(true);
		expect(first.track.hasLanded).toBe(false);
	});

	it("gives the same answer for the same track and move", () => {
		const track = startSafePolygon("bottom", 150, 121, 0);
		const input = move(95, 128, { now: 1 });
		expect(decideSafePolygon(track, input)).toEqual(decideSafePolygon(track, input));
	});

	it("closes a pointer that stops moving inside the triangle", () => {
		const start = startSafePolygon("bottom", 150, 121, 0);
		const first = decideSafePolygon(start, move(95, 128, { now: 1 }));
		// 1px in 100ms is slower than the threshold.
		const slow = decideSafePolygon(first.track, move(96, 128, { now: 101 }));
		expect(slow.decision).toBe("close");
	});
});

describe("SafePolygon", () => {
	it("stays open in the trough between trigger and popup", () => {
		const polygon = new SafePolygon("bottom", 150, 120, 0);
		expect(polygon.decide(move(150, 125, { now: 10 }))).toBe("stay");
	});

	it("closes when leaving away from the popup", () => {
		const polygon = new SafePolygon("bottom", 150, 100, 0);
		expect(polygon.decide(move(150, 90, { isLeave: true }))).toBe("close");
	});

	it("waits for the pointer inside the triangle, and stays once landed", () => {
		const polygon = new SafePolygon("bottom", 150, 121, 0);
		expect(polygon.decide(move(95, 128, { now: 1 }))).toBe("close-soon");
		expect(polygon.decide(move(95, 140, { isOverFloating: true, now: 2 }))).toBe("stay");
	});

	it("stays open while a nested child is open", () => {
		const polygon = new SafePolygon("bottom", 150, 121, 0);
		expect(polygon.decide(move(400, 400, { hasOpenChild: true }))).toBe("stay");
	});

	it.each(["top", "bottom", "left", "right"] as const)(
		"keeps open while moving through the trough on %s placement",
		(placement) => {
			const scenario = createPlacementScenario(placement);
			const polygon = new SafePolygon(placement, scenario.leavePoint[0], scenario.leavePoint[1], 0);

			const decision = polygon.decide(
				createMouseMove(scenario, scenario.troughPoint[0], scenario.troughPoint[1]),
			);

			expect(decision).toBe("stay");
		},
	);

	it.each(["top", "bottom", "left", "right"] as const)(
		"closes when moving away from corridor on %s placement",
		(placement) => {
			const scenario = createPlacementScenario(placement);
			const polygon = new SafePolygon(placement, scenario.leavePoint[0], scenario.leavePoint[1], 0);

			const decision = polygon.decide(
				createMouseMove(scenario, scenario.outsidePoint[0], scenario.outsidePoint[1]),
			);

			expect(decision).toBe("close");
		},
	);
});
