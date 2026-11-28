// The positioning steps: their order, their options, and what one computation records. The
// computations run the positioning library's own `computePosition` on a fake platform over plain
// rectangles.

import { computePosition, type Middleware, type Platform } from "@floating-ui/core";
import { describe, expect, it, vi } from "vitest";

import {
	type Measured,
	POSITIONER_DEFAULTS,
	positionerMiddleware,
	type PositionerMiddlewareOptions,
} from "../../../src/foundation/position/index.js";
import {
	measuredArrow,
	type PlatformPositioning,
} from "../../../src/foundation/position/position-positioner-middleware.js";
import {
	type Rect,
	shiftLimitOffset,
	type Size,
	snapLength,
} from "../../../src/foundation/position/position-rules.js";

const DEFAULTS: PositionerMiddlewareOptions = {
	side: "bottom",
	rtl: false,
	...POSITIONER_DEFAULTS,
};

const PAGE: Rect = { x: 0, y: 0, width: 500, height: 500 };
const ANCHOR: Rect = { x: 100, y: 100, width: 40, height: 20 };
const POPUP: Size = { width: 80, height: 50 };

function platformWith(
	arrow: Size | null,
	extra: Partial<PlatformPositioning> = {},
): PlatformPositioning {
	return {
		arrow: measuredArrow(arrow),
		anchorOverflow: async (state, next) =>
			next(await state.platform.detectOverflow(state, { elementContext: "reference" })),
		...extra,
	};
}

function names(steps: Middleware[]) {
	return steps.map((step) => step.name);
}

function step(steps: Middleware[], name: string) {
	const found = steps.find((entry) => entry.name === name);
	if (!found) {
		throw new Error(`no ${name} step`);
	}
	return found;
}

// The positioning library's platform over rectangles: the page clips everything.
function run(steps: Middleware[], anchor: Rect = ANCHOR, placement: string = "bottom") {
	const platform: Platform = {
		getElementRects: () => ({
			reference: anchor,
			floating: { x: 0, y: 0, width: POPUP.width, height: POPUP.height },
		}),
		getClippingRect: () => PAGE,
		getDimensions: () => POPUP,
	};
	return computePosition("anchor", "popup", {
		placement: placement as "bottom",
		strategy: "absolute",
		platform,
		middleware: steps,
	});
}

describe("the steps' order", () => {
	it("shifts before it flips a centred popup, and ends with the arrow, origin and hide", () => {
		const steps = positionerMiddleware(DEFAULTS, platformWith(null), {});

		expect(names(steps)).toEqual([
			"offset",
			"shift",
			"flip",
			"size",
			"arrow",
			"transformOrigin",
			"hide",
		]);
	});

	it("flips before it shifts an aligned popup", () => {
		const steps = positionerMiddleware({ ...DEFAULTS, align: "start" }, platformWith(null), {});

		expect(names(steps).slice(0, 3)).toEqual(["offset", "flip", "shift"]);
	});

	it("puts the platform's own steps first and last", () => {
		const first: Middleware = { name: "inline", fn: () => ({}) };
		const last: Middleware = { name: "adaptiveOrigin", fn: () => ({}) };
		const steps = positionerMiddleware(DEFAULTS, platformWith(null, { first, last }), {});

		expect(steps[0]).toBe(first);
		expect(steps.at(-1)).toBe(last);
		expect(steps).toHaveLength(9);
	});

	it("leaves out the flip when the side never flips, and the shift when nothing shifts", () => {
		const noFlip = positionerMiddleware(
			{ ...DEFAULTS, collisionAvoidance: { side: "none" } },
			platformWith(null),
			{},
		);
		const noShift = positionerMiddleware(
			{ ...DEFAULTS, align: "start", collisionAvoidance: { align: "none" } },
			platformWith(null),
			{},
		);

		expect(names(noFlip)).not.toContain("flip");
		expect(names(noFlip)).toContain("shift");
		expect(names(noShift)).not.toContain("shift");
		expect(names(noShift)).toContain("flip");
	});
});

describe("the steps' options", () => {
	it("limits the shift by the arrow's outer size by default, and hands the boundaries on", () => {
		const box = vi.fn((): Size | null => ({ width: 10, height: 10 }));
		const steps = positionerMiddleware(
			{ ...DEFAULTS, shift: { rootBoundary: "document" } },
			{ ...platformWith(null), arrow: { ...measuredArrow(null), box }, boundary: "page" },
			{},
		);
		const options = step(steps, "shift").options;

		expect(options).toMatchObject({
			boundary: "page",
			rootBoundary: "document",
			padding: { top: 5, right: 5, bottom: 5, left: 5 },
			mainAxis: true,
			crossAxis: false,
		});
		const limit = options.limiter.options as (state: { placement: string }) => unknown;
		expect(limit({ placement: "bottom" })).toEqual({
			offset: shiftLimitOffset({ width: 10, height: 10 }, "bottom", {
				top: 5,
				right: 5,
				bottom: 5,
				left: 5,
			}),
		});
		box.mockReturnValue(null);
		expect(limit({ placement: "bottom" })).toEqual({});
	});

	it("shifts along both axes without a limit when sticky", () => {
		const steps = positionerMiddleware({ ...DEFAULTS, sticky: true }, platformWith(null), {});
		const options = step(steps, "shift").options;

		expect(options.crossAxis).toBe(true);
		expect(options.limiter).toBe(undefined);
		expect(options.rootBoundary).toBe(undefined);
	});

	it("flips on the side's axis and the alignment, toward the fallback side", () => {
		const steps = positionerMiddleware(DEFAULTS, platformWith(null), {});
		const crossAxis = positionerMiddleware(
			{ ...DEFAULTS, shift: { crossAxis: true } },
			platformWith(null),
			{},
		);

		expect(step(steps, "flip").options()).toMatchObject({
			mainAxis: true,
			crossAxis: "alignment",
			fallbackAxisSideDirection: "end",
		});
		expect(step(crossAxis, "flip").options()).toMatchObject({ mainAxis: false });
		expect(step(crossAxis, "shift").options).toMatchObject({ crossAxis: true });
	});

	it("flips with the biased padding until the size step has run, then with the plain one", async () => {
		const steps = positionerMiddleware(DEFAULTS, platformWith(null), {});
		const flipOptions = step(steps, "flip").options as () => { padding: unknown };

		expect(flipOptions().padding).toEqual({ top: 7, right: 6, bottom: 6, left: 6 });
		await run(steps);
		expect(flipOptions().padding).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
	});
});

describe("one computation", () => {
	it("places the popup and its arrow, and records the room, the anchor and the origin", async () => {
		const measured: Measured = {};
		const sized = vi.fn();
		const steps = positionerMiddleware(
			{ ...DEFAULTS, sideOffset: 4 },
			platformWith({ width: 10, height: 10 }, { sized }),
			measured,
		);

		const result = await run(steps);

		expect(result).toMatchObject({ x: 80, y: 124, placement: "bottom" });
		expect(result.middlewareData.arrow).toEqual({ x: 35, centerOffset: 0 });
		expect(measured).toEqual({
			availableWidth: 490,
			availableHeight: 371,
			anchorWidth: 40,
			anchorHeight: 20,
			transformOrigin: { x: { px: 40 }, y: { px: -4 } },
			anchorHidden: false,
		});
		expect(sized).toHaveBeenCalledWith(
			expect.objectContaining({ availableWidth: 490, availableHeight: 371 }),
		);
	});

	it("snaps the anchor's size to the platform's device pixels", async () => {
		const measured: Measured = {};
		const anchor: Rect = { x: 100.2, y: 100.4, width: 40.3, height: 20.3 };
		const steps = positionerMiddleware(
			DEFAULTS,
			platformWith(null, { devicePixelRatio: () => 2 }),
			measured,
		);

		await run(steps, anchor);

		expect(measured.anchorWidth).toBe(snapLength(100.2, 40.3, 2));
		expect(measured.anchorHeight).toBe(snapLength(100.4, 20.3, 2));
	});

	it("grows an aligned popup without an arrow from its aligned edge, in the popup's direction", async () => {
		const ltr: Measured = {};
		const rtl: Measured = {};
		const popupRtl: Measured = {};
		const options = { ...DEFAULTS, align: "start" as const };

		await run(positionerMiddleware(options, platformWith(null), ltr), ANCHOR, "bottom-start");
		await run(
			positionerMiddleware({ ...options, rtl: true }, platformWith(null), rtl),
			ANCHOR,
			"bottom-start",
		);
		await run(
			positionerMiddleware(options, platformWith(null, { popupRtl: () => true }), popupRtl),
			ANCHOR,
			"bottom-start",
		);

		expect(ltr.transformOrigin?.x).toEqual({ percent: 0 });
		expect(rtl.transformOrigin?.x).toEqual({ percent: 100 });
		expect(popupRtl.transformOrigin?.x).toEqual({ percent: 100 });
	});

	it("places a virtual arrow of no size without padding when there is no Arrow part", async () => {
		const result = await run(positionerMiddleware(DEFAULTS, platformWith(null), {}));

		// The popup's centre: half its width from its start edge.
		expect(result.middlewareData.arrow).toEqual({ x: 40, centerOffset: 0 });
	});

	it("places an arrow the platform measures asynchronously", async () => {
		const arrow = {
			...measuredArrow(null),
			measure: async (
				_state: unknown,
				place: Parameters<PlatformPositioning["arrow"]["measure"]>[1],
			) =>
				place({
					present: true,
					size: await Promise.resolve({ width: 10, height: 10 }),
					popupClient: POPUP,
				}),
		};
		const result = await run(positionerMiddleware(DEFAULTS, { ...platformWith(null), arrow }, {}));

		expect(result.middlewareData.arrow).toEqual({ x: 35, centerOffset: 0 });
	});

	it("asks both offset functions with one input, the side's first", async () => {
		const calls: string[] = [];
		const inputs: object[] = [];
		const sideOffset = vi.fn((input: object) => {
			calls.push("side");
			inputs.push(input);
			return 8;
		});
		const alignOffset = vi.fn((input: object) => {
			calls.push("align");
			inputs.push(input);
			return 3;
		});
		const steps = positionerMiddleware(
			{ ...DEFAULTS, sideOffset, alignOffset, collisionAvoidance: { side: "none", align: "none" } },
			platformWith(null),
			{},
		);

		const result = await run(steps);

		expect(calls.slice(0, 2)).toEqual(["side", "align"]);
		expect(inputs[0]).toBe(inputs[1]);
		expect(inputs[0]).toEqual({
			side: "bottom",
			align: "center",
			anchor: { width: 40, height: 20 },
			positioner: { width: 80, height: 50 },
		});
		expect(result).toMatchObject({ x: 83, y: 128 });
	});

	it("records a hidden anchor when it is clipped away", async () => {
		const measured: Measured = {};
		const result = await run(positionerMiddleware(DEFAULTS, platformWith(null), measured), {
			x: 100,
			y: -40,
			width: 40,
			height: 20,
		});

		expect(measured.anchorHidden).toBe(true);
		expect(result.middlewareData.hide).toEqual({ referenceHidden: true });
	});
});
