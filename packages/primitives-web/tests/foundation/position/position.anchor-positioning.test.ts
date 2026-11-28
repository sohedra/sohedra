// The positioning cases the Popover and Tooltip tests don't cover.
// - "uses the visual viewport for shift by default": the middleware comes from
// `createPositionerMiddleware`, and the positioning library's middleware keeps its `options`, so
// the test reads them from the `shift` middleware built for the default options.
// - The lazy flipping cases run fixtures/position-anchor-positioning-probe.svelte: `usePositioner`
// inside an open Popover.Root, whose store is the popup state it reads, with a fixed anchor, a
// popup that shrinks, and the options under test.

import { describe, expect, it } from "vitest";

import { createPositionerMiddleware } from "#lib/foundation/position/position-positioner-middleware.js";

import { createRenderer, screen, waitFor } from "../../shim/index.js";
import AnchorPositioning from "./fixtures/position-anchor-positioning.svelte";

describe("useAnchorPositioning", () => {
	const { render } = createRenderer();

	it("uses the visual viewport for shift by default", () => {
		const middleware = createPositionerMiddleware(
			{
				side: "bottom",
				align: "center",
				rtl: false,
				sideOffset: 0,
				alignOffset: 0,
				sticky: false,
				arrowPadding: 5,
				collisionPadding: 5,
				collisionBoundary: "clipping-ancestors",
				collisionAvoidance: { fallbackAxisSide: "none" },
				adaptiveOrigin: false,
				arrowElement: null,
			},
			{},
		);
		const shift = middleware.find((item) => item.name === "shift") as
			| { options?: { rootBoundary?: unknown } }
			| undefined;

		expect(shift).not.toBe(undefined);
		expect(shift?.options?.rootBoundary).toBe(undefined);
	});

	it("locks a flipped alignment after the popup shrinks", async () => {
		// Only `'placement'` locks the align axis. Plain `true` stays side-only so Combobox keeps
		// recomputing its alignment.
		const { user } = await render(AnchorPositioning, { lazyFlip: "placement" });
		const floating = screen.getByTestId("floating");

		await waitFor(() => {
			expect(floating).toHaveAttribute("data-align", "end");
		});

		await user.click(screen.getByRole("button", { name: "Shrink" }));

		await waitFor(() => {
			const anchorBottom = screen.getByTestId("anchor").getBoundingClientRect().bottom;
			const floatingBottom = floating.getBoundingClientRect().bottom;
			expect(Math.abs(anchorBottom - floatingBottom)).toBeLessThan(1);
		});

		expect(floating).toHaveAttribute("data-align", "end");
	});

	it("leaves the alignment free when lazy flipping is side-only", async () => {
		const { user } = await render(AnchorPositioning, { lazyFlip: true });
		const floating = screen.getByTestId("floating");

		await waitFor(() => {
			expect(floating).toHaveAttribute("data-align", "end");
		});

		await user.click(screen.getByRole("button", { name: "Shrink" }));

		await waitFor(() => {
			expect(floating).toHaveAttribute("data-align", "start");
		});
	});

	it("locks a flipped side after the popup shrinks", async () => {
		const { user } = await render(AnchorPositioning, { side: "bottom", align: "center" });
		const floating = screen.getByTestId("floating");

		// The anchor sits at the viewport's bottom edge, so the popup flips above it.
		await waitFor(() => {
			expect(floating).toHaveAttribute("data-side", "top");
		});

		// Shrinking makes the preferred bottom side fit again, but the flip is locked.
		await user.click(screen.getByRole("button", { name: "Shrink" }));

		await waitFor(() => {
			const anchorTop = screen.getByTestId("anchor").getBoundingClientRect().top;
			const floatingBottom = floating.getBoundingClientRect().bottom;
			expect(Math.abs(anchorTop - floatingBottom)).toBeLessThan(1);
		});

		expect(floating).toHaveAttribute("data-side", "top");
	});

	it("flips back to the preferred side without lazy flipping", async () => {
		const { user } = await render(AnchorPositioning, {
			side: "bottom",
			align: "center",
			lazyFlip: false,
		});
		const floating = screen.getByTestId("floating");

		await waitFor(() => {
			expect(floating).toHaveAttribute("data-side", "top");
		});

		await user.click(screen.getByRole("button", { name: "Shrink" }));

		await waitFor(() => {
			expect(floating).toHaveAttribute("data-side", "bottom");
		});
	});
});
