// The safe polygon per placement. A decision of `"close"` is a close at once, `"stay"` none; the
// moves are over neither element and are not a leave.

import { describe, expect, it } from "vitest";

import { SafePolygon } from "../../../src/foundation/hover/hover-intent.js";
import type {
	Box,
	SafePolygonInput,
} from "../../../src/foundation/hover/hover-safe-polygon-rules.js";

function createRect(left: number, top: number, width: number, height: number): Box {
	return { left, top, width, height, right: left + width, bottom: top + height };
}

function createPlacementScenario(placement: "top" | "bottom" | "left" | "right") {
	const referenceRect = createRect(0, 0, 100, 100);

	switch (placement) {
		case "top":
			return {
				referenceRect,
				floatingRect: createRect(0, -120, 100, 100),
				leavePoint: [50, 0] as const,
				troughPoint: [50, -10] as const,
				outsidePoint: [50, 150] as const,
			};
		case "bottom":
			return {
				referenceRect,
				floatingRect: createRect(0, 120, 100, 100),
				leavePoint: [50, 100] as const,
				troughPoint: [50, 110] as const,
				outsidePoint: [50, -50] as const,
			};
		case "left":
			return {
				referenceRect,
				floatingRect: createRect(-120, 0, 100, 100),
				leavePoint: [0, 50] as const,
				troughPoint: [-10, 50] as const,
				outsidePoint: [150, 50] as const,
			};
		case "right":
			return {
				referenceRect,
				floatingRect: createRect(120, 0, 100, 100),
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

describe("safePolygon", () => {
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
