// The middleware a Positioner builds for its options: its `hide`, compared with the positioning
// library's own, and its `shift`, whose boundary is the visual viewport by default. Neither is
// exported, so each is the one of that name in the list `createPositionerMiddleware` builds.
import {
	hide as nativeHide,
	type MiddlewareState,
	type Rect,
	type SideObject,
} from "@floating-ui/dom";
import { describe, expect, it, vi } from "vitest";

import { createPositionerMiddleware } from "#lib/foundation/position/position-positioner-middleware.js";

type PositionerOptions = Parameters<typeof createPositionerMiddleware>[0];

const DEFAULTS: PositionerOptions = {
	side: "bottom",
	align: "center",
	rtl: false,
	sideOffset: 0,
	alignOffset: 0,
	sticky: false,
	arrowPadding: 5,
	collisionPadding: 5,
	collisionBoundary: "clipping-ancestors",
	collisionAvoidance: {},
	adaptiveOrigin: false,
	arrowElement: null,
};

const floatingRect: Rect = { x: 0, y: 0, width: 5, height: 5 };

/** The middleware named `name` for `options`. */
function middleware(name: string, options: Partial<PositionerOptions> = {}) {
	return createPositionerMiddleware({ ...DEFAULTS, ...options }, {}).find(
		(item) => item.name === name,
	);
}

/** A middleware state whose reference has `reference` and overflows by `overflow`. */
function createState(reference: Rect, overflow: SideObject): MiddlewareState {
	return {
		x: 0,
		y: 0,
		initialPlacement: "bottom",
		placement: "bottom",
		strategy: "absolute",
		middlewareData: {},
		elements: {
			reference: document.createElement("button"),
			floating: document.createElement("div"),
		},
		rects: { reference, floating: floatingRect },
		platform: {
			detectOverflow: vi.fn(async () => overflow),
			getElementRects: vi.fn(async () => ({ reference, floating: floatingRect })),
			getClippingRect: vi.fn(async () => reference),
			getDimensions: vi.fn(async () => ({ width: 5, height: 5 })),
		},
	} as unknown as MiddlewareState;
}

describe("createPositionerMiddleware", () => {
	describe("hide", () => {
		const hide = middleware("hide")!;

		it.each([
			{ name: "nowhere", overflow: { top: 19, right: 9, bottom: 19, left: 9 }, expected: false },
			{ name: "at the top", overflow: { top: 20, right: 9, bottom: 19, left: 9 }, expected: true },
			{
				name: "on the right",
				overflow: { top: 19, right: 10, bottom: 19, left: 9 },
				expected: true,
			},
			{
				name: "at the bottom",
				overflow: { top: 19, right: 9, bottom: 20, left: 9 },
				expected: true,
			},
			{
				name: "on the left",
				overflow: { top: 19, right: 9, bottom: 19, left: 10 },
				expected: true,
			},
		] satisfies Array<{ name: string; overflow: SideObject; expected: boolean }>)(
			"agrees with the library's hide() when the reference overflows $name",
			async ({ overflow, expected }) => {
				const state = createState({ x: 1, y: 2, width: 10, height: 20 }, overflow);

				const nativeResult = await nativeHide().fn(state);
				const result = await hide.fn(state);

				expect(result.data?.referenceHidden).toBe(nativeResult.data?.referenceHidden);
				expect(result.data?.referenceHidden).toBe(expected);
				expect(state.platform.detectOverflow).toHaveBeenCalledTimes(2);
				expect(state.platform.detectOverflow).toHaveBeenNthCalledWith(1, state, {
					elementContext: "reference",
				});
				expect(state.platform.detectOverflow).toHaveBeenNthCalledWith(2, state, {
					elementContext: "reference",
				});
			},
		);

		it("treats an all-zero reference rect as hidden", async () => {
			const state = createState(
				{ x: 0, y: 0, width: 0, height: 0 },
				{ top: -1, right: -1, bottom: -1, left: -1 },
			);

			const nativeResult = await nativeHide().fn(state);
			const result = await hide.fn(state);

			expect(nativeResult.data?.referenceHidden).toBe(false);
			expect(result.data?.referenceHidden).toBe(true);
		});
	});

	describe("shift", () => {
		it("uses the visual viewport for shift by default", () => {
			const shift = middleware("shift", { collisionAvoidance: { fallbackAxisSide: "none" } }) as
				| { options?: { rootBoundary?: unknown } }
				| undefined;

			expect(shift).not.toBe(undefined);
			expect(shift?.options?.rootBoundary).toBe(undefined);
		});
	});
});
