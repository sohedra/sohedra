// The placement rules as facts in and an outcome out: sides and placements, lazy flipping,
// collision avoidance, measuring, the arrow, the transform origin, and when two positions render
// the same.
import { describe, expect, it } from "vitest";

import {
	getAlignment,
	getSide,
	initialPosition,
	logicalSide,
	measureFromFarEdges,
	requestedPlacement,
	roundToDevicePixels,
	samePosition,
} from "../../../src/foundation/position/index.js";
import {
	collisionPlan,
	flipPadding,
	getSideAxis,
	isAnchorHidden,
	normalizePadding,
	offsetInput,
	physicalSide,
	placeArrow,
	shiftLimitOffset,
	snapLength,
	toPlacement,
	transformOrigin,
	type TransformOriginInput,
} from "../../../src/foundation/position/position-rules.js";

describe("sides and placements", () => {
	it("resolves logical sides by the text direction", () => {
		expect(physicalSide("inline-end", false)).toBe("right");
		expect(physicalSide("inline-end", true)).toBe("left");
		expect(physicalSide("inline-start", false)).toBe("left");
		expect(physicalSide("inline-start", true)).toBe("right");
		expect(physicalSide("top", true)).toBe("top");
	});

	it("reports a rendered side logically only when it was asked for logically", () => {
		expect(logicalSide("inline-end", "right", false)).toBe("inline-end");
		expect(logicalSide("inline-end", "left", false)).toBe("inline-start");
		expect(logicalSide("inline-start", "right", true)).toBe("inline-start");
		expect(logicalSide("right", "left", false)).toBe("left");
		expect(logicalSide("inline-end", "top", false)).toBe("top");
	});

	it("starts unpositioned on the requested placement", () => {
		expect(initialPosition({ side: "inline-start", align: "end", rtl: true })).toEqual({
			isPositioned: false,
			x: 0,
			y: 0,
			strategy: "absolute",
			side: "inline-start",
			physicalSide: "right",
			align: "end",
			anchorHidden: false,
			arrow: null,
		});
	});

	it("splits and joins a placement", () => {
		expect(getSide("bottom-start")).toBe("bottom");
		expect(getAlignment("bottom-start")).toBe("start");
		expect(getAlignment("left")).toBe(undefined);
		expect(getSideAxis("top")).toBe("y");
		expect(getSideAxis("left")).toBe("x");
		expect(toPlacement("top", "center")).toBe("top");
		expect(toPlacement("right", "end")).toBe("right-end");
	});

	it("gives an offset function the logical side and both sizes", () => {
		expect(
			offsetInput(
				"inline-end",
				"left-start",
				false,
				{ width: 10, height: 20 },
				{ width: 30, height: 40 },
			),
		).toEqual({
			side: "inline-start",
			align: "start",
			anchor: { width: 10, height: 20 },
			positioner: { width: 30, height: 40 },
		});
	});
});

describe("lazy flipping", () => {
	const request = { side: "bottom", align: "start", rtl: false } as const;

	it("asks for the requested placement while nothing is kept", () => {
		expect(requestedPlacement(request)).toBe("bottom-start");
		expect(requestedPlacement({ ...request, align: "center" })).toBe("bottom");
	});
});

describe("collision avoidance", () => {
	const input = { align: "start", sticky: false, shiftCrossAxis: false } as const;

	it("flips the side and the alignment and limits the shift by default", () => {
		expect(collisionPlan({}, input)).toEqual({
			flip: { mainAxis: true, crossAxis: "alignment", fallbackAxisSide: "end" },
			shift: { mainAxis: true, crossAxis: false, limited: true },
			shiftFirst: false,
			crossAxisShiftEnabled: false,
		});
	});

	it("shifts before it flips for a centred popup or a shifting axis", () => {
		expect(collisionPlan({}, { ...input, align: "center" }).shiftFirst).toBe(true);
		expect(collisionPlan({ align: "shift" }, input).shiftFirst).toBe(true);
		expect(collisionPlan({ side: "shift" }, input).shiftFirst).toBe(true);
	});

	it("never flips with side 'none', and never shifts with align 'none'", () => {
		expect(collisionPlan({ side: "none" }, input).flip).toBe(null);
		expect(collisionPlan({ align: "none" }, input).shift).toBe(null);
		// A side that shifts still shifts.
		expect(collisionPlan({ side: "shift", align: "none" }, input).shift).toEqual({
			mainAxis: false,
			crossAxis: true,
			limited: true,
		});
	});

	it("shifts along the side's axis without a limit when sticky or asked to", () => {
		expect(collisionPlan({}, { ...input, sticky: true }).shift).toEqual({
			mainAxis: true,
			crossAxis: true,
			limited: false,
		});
		const crossAxis = collisionPlan({}, { ...input, shiftCrossAxis: true });
		expect(crossAxis.shift?.limited).toBe(false);
		expect(crossAxis.flip?.mainAxis).toBe(false);
		expect(crossAxis.crossAxisShiftEnabled).toBe(true);
	});

	it("biases the flip towards the requested side", () => {
		const padding = normalizePadding(5);
		expect(flipPadding(padding, "bottom")).toEqual({ top: 7, right: 6, bottom: 6, left: 6 });
		expect(flipPadding(padding, "left")).toEqual({ top: 6, right: 7, bottom: 6, left: 6 });
		expect(flipPadding(padding, "inline-end")).toEqual({ top: 6, right: 6, bottom: 6, left: 6 });
	});

	it("measures the flip with the plain padding once the popup was sized on the side tried", () => {
		const padding = normalizePadding({ top: 5, right: 4, bottom: 3, left: 2 });
		expect(flipPadding(padding, "bottom", true)).toEqual({ top: 5, right: 4, bottom: 3, left: 2 });
		expect(flipPadding(padding, "left", true)).toEqual({ top: 5, right: 4, bottom: 3, left: 2 });
		// Before that, with the bias.
		expect(flipPadding(padding, "bottom", false)).toEqual({ top: 7, right: 5, bottom: 4, left: 3 });
	});

	it("stops a limited shift when half the arrow has left the anchor", () => {
		const padding = normalizePadding({ left: 4, right: 6, top: 1 });
		expect(shiftLimitOffset({ width: 10, height: 20 }, "bottom", padding)).toBe(10);
		expect(shiftLimitOffset({ width: 10, height: 20 }, "left", padding)).toBe(10.5);
	});

	it("fills in missing padding sides", () => {
		expect(normalizePadding({ top: 3 })).toEqual({ top: 3, right: 0, bottom: 0, left: 0 });
	});
});

describe("measuring", () => {
	it("rounds to device pixels", () => {
		expect(roundToDevicePixels(10.3, 2)).toBe(10.5);
		expect(roundToDevicePixels(10.3, 1)).toBe(10);
		// A length is snapped at both ends, so it matches what is drawn.
		expect(snapLength(0.4, 10.3, 1)).toBe(11);
		expect(snapLength(0.6, 10.3, 1)).toBe(10);
	});

	it("hides an anchor that is clipped away or collapsed at the origin", () => {
		const anchor = { x: 1, y: 2, width: 10, height: 20 };
		expect(isAnchorHidden(anchor, { top: 19, right: 9, bottom: 19, left: 9 })).toBe(false);
		expect(isAnchorHidden(anchor, { top: 20, right: 9, bottom: 19, left: 9 })).toBe(true);
		expect(isAnchorHidden(anchor, { top: 19, right: 9, bottom: 19, left: 10 })).toBe(true);
		const none = { top: -1, right: -1, bottom: -1, left: -1 };
		expect(isAnchorHidden({ x: 0, y: 0, width: 0, height: 0 }, none)).toBe(true);
	});

	it("measures from the far edges on the left and top sides", () => {
		const popup = { width: 100, height: 50 };
		const container = { width: 800, height: 600 };
		expect(measureFromFarEdges("bottom", { x: 10, y: 20 }, popup, container)).toEqual({
			x: 10,
			y: 20,
			sideX: "left",
			sideY: "top",
		});
		expect(measureFromFarEdges("top", { x: 10, y: 20 }, popup, container)).toEqual({
			x: 10,
			y: 530,
			sideX: "left",
			sideY: "bottom",
		});
		expect(measureFromFarEdges("left", { x: 10, y: 20 }, popup, container)).toEqual({
			x: 690,
			y: 20,
			sideX: "right",
			sideY: "top",
		});
	});
});

describe("the arrow", () => {
	const base = {
		placement: "bottom",
		x: 100,
		y: 60,
		anchor: { x: 130, y: 20, width: 40, height: 40 },
		popup: { width: 100, height: 50 },
		popupClient: { width: 100, height: 50 },
		arrow: { width: 10, height: 5 },
		padding: normalizePadding(5),
		placed: false,
	};

	it("points at the anchor's centre", () => {
		expect(placeArrow(base)).toEqual({
			axis: "x",
			offset: 45,
			centerOffset: 0,
			movesPopup: false,
			alignmentOffset: 0,
		});
	});

	it("stays within its padding and reports how far it is off centre", () => {
		const placed = placeArrow({ ...base, anchor: { x: 10, y: 20, width: 40, height: 40 } });
		expect(placed.offset).toBe(5);
		expect(placed.centerOffset).toBe(-80);
		expect(placed.movesPopup).toBe(false);
	});

	it("moves an aligned popup once when the anchor is too small for the padding", () => {
		const input = {
			...base,
			placement: "bottom-start",
			x: 100,
			anchor: { x: 100, y: 20, width: 8, height: 40 },
		};
		const first = placeArrow(input);
		expect(first.movesPopup).toBe(true);
		expect(first.alignmentOffset).toBe(-6);
		expect(first.offset).toBe(5);
		// The second pass of the same computation doesn't move it again.
		expect(placeArrow({ ...input, placed: true }).movesPopup).toBe(false);
	});

	it("uses the popup's outer size along an axis without an inner one", () => {
		const placed = placeArrow({ ...base, popupClient: { width: 0, height: 0 } });
		expect(placed.offset).toBe(45);
	});
});

describe("the transform origin", () => {
	const base: TransformOriginInput = {
		placement: "bottom-start",
		hasArrow: false,
		arrow: { width: 0, height: 0 },
		arrowOffset: {},
		shift: { x: 0, y: 0 },
		rtl: false,
		sideOffset: 8,
		crossAxisShiftEnabled: false,
		anchor: { x: 100, y: 20, width: 40, height: 40 },
		y: 68,
	};

	it("grows an aligned arrowless popup from its aligned edge", () => {
		expect(transformOrigin(base)).toEqual({ x: { percent: 0 }, y: { px: -8 } });
		expect(transformOrigin({ ...base, placement: "bottom-end" }).x).toEqual({ percent: 100 });
		expect(transformOrigin({ ...base, rtl: true }).x).toEqual({ percent: 100 });
	});

	it("grows from the arrow once a shift breaks the alignment, or with an Arrow part", () => {
		expect(transformOrigin({ ...base, shift: { x: 3, y: 0 }, arrowOffset: { x: 12 } }).x).toEqual({
			px: 12,
		});
		expect(
			transformOrigin({
				...base,
				hasArrow: true,
				arrow: { width: 10, height: 5 },
				arrowOffset: { x: 12 },
			}).x,
		).toEqual({ px: 17 });
	});

	it("measures the side's origin from the far edge on the top and left sides", () => {
		expect(transformOrigin({ ...base, placement: "top" }).y).toEqual({ percent: 100, px: 8 });
		expect(transformOrigin({ ...base, placement: "left-start" })).toEqual({
			x: { percent: 100, px: 8 },
			y: { percent: 0 },
		});
	});

	it("grows from the anchor's middle when the popup shifted over it", () => {
		const origin = transformOrigin({
			...base,
			crossAxisShiftEnabled: true,
			shift: { x: 0, y: -30 },
		});
		expect(origin.y).toEqual({ px: -28 });
	});

	it("reads the text direction only for an aligned popup above or below", () => {
		let reads = 0;
		// A spread would read the getter, so each input is built with it.
		const lazy = (overrides: Partial<TransformOriginInput>): TransformOriginInput => ({
			...base,
			...overrides,
			get rtl() {
				reads += 1;
				return false;
			},
		});
		transformOrigin(lazy({ hasArrow: true }));
		transformOrigin(lazy({ placement: "bottom" }));
		transformOrigin(lazy({ placement: "left-start" }));
		expect(reads).toBe(0);
		transformOrigin(lazy({}));
		expect(reads).toBe(1);
	});
});

describe("samePosition", () => {
	const position = initialPosition({ side: "bottom", align: "center", rtl: false });

	it("compares what renders", () => {
		expect(samePosition(position, { ...position })).toBe(true);
		expect(samePosition(position, { ...position, x: 1 })).toBe(false);
		expect(samePosition(position, { ...position, availableHeight: 10 })).toBe(false);
		expect(
			samePosition(
				{ ...position, transformOrigin: { x: { px: 1 }, y: { percent: 100, px: 2 } } },
				{ ...position, transformOrigin: { x: { px: 1 }, y: { percent: 100, px: 2 } } },
			),
		).toBe(true);
		expect(
			samePosition(
				{ ...position, transformOrigin: { x: { px: 1 }, y: { px: 2 } } },
				{ ...position, transformOrigin: { x: { px: 1 }, y: { px: 3 } } },
			),
		).toBe(false);
	});
});
