// usePositioner through an open Popover asked for below its anchor: a popup capped to its space
// whose content grows while open, with the default 5-pixel collision padding.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";

import CappedGrowingPopover from "./fixtures/position-capped-growing.svelte";

const PADDING = 5;
const ANCHOR_HEIGHT = 20;
const SMALL = 40;
const HUGE = 5000;

describe("usePositioner", () => {
	describe("a capped popup that grows while open", () => {
		/** The anchor's top edge: below the middle, so the larger side is above it. */
		const lowAnchorTop = () => Math.round(window.innerHeight * 0.6);
		/** Above the middle: the larger side is the requested one, below. */
		const highAnchorTop = () => Math.round(window.innerHeight * 0.3);

		async function setup(anchorTop: number, contentHeight: number) {
			const screen = await render(CappedGrowingPopover, { anchorTop, contentHeight });
			const positioner = screen.getByTestId("positioner");
			const popup = screen.getByTestId("popup");
			const popupRect = () => popup.element().getBoundingClientRect();
			return { screen, positioner, popupRect, grow: screen.component.setContentHeight };
		}

		it("moves to the side with more room when its content outgrows both sides", async () => {
			const anchorTop = lowAnchorTop();
			const { positioner, popupRect, grow } = await setup(anchorTop, SMALL);
			await expect.element(positioner).toHaveAttribute("data-side", "bottom");

			grow(HUGE);

			await expect.element(positioner).toHaveAttribute("data-side", "top");
			// It fills the room above the anchor, down to the anchor's edge.
			await expect
				.poll(() => Math.abs(popupRect().height - (anchorTop - PADDING)))
				.toBeLessThan(1.5);
			await expect.poll(() => Math.abs(popupRect().bottom - anchorTop)).toBeLessThan(1.5);
		});

		it("ends on the same side as a popup opened with that content", async () => {
			const { screen, positioner, grow } = await setup(lowAnchorTop(), SMALL);
			await expect.element(positioner).toHaveAttribute("data-side", "bottom");
			grow(HUGE);
			await expect.element(positioner).toHaveAttribute("data-side", "top");

			screen.component.setOpen(false);
			await expect.poll(() => positioner.query()).toBe(null);
			screen.component.setOpen(true);

			await expect.element(positioner).toHaveAttribute("data-side", "top");
		});

		it("opens on the side with more room when the content fits neither", async () => {
			const { positioner } = await setup(lowAnchorTop(), HUGE);

			await expect.element(positioner).toHaveAttribute("data-side", "top");
		});

		it("stays on the requested side when that is the one with more room", async () => {
			const anchorTop = highAnchorTop();
			const { positioner, popupRect, grow } = await setup(anchorTop, SMALL);
			await expect.element(positioner).toHaveAttribute("data-side", "bottom");

			grow(HUGE);

			const room = window.innerHeight - (anchorTop + ANCHOR_HEIGHT) - PADDING;
			await expect.poll(() => Math.abs(popupRect().height - room)).toBeLessThan(1.5);
			await expect.element(positioner).toHaveAttribute("data-side", "bottom");
		});

		it("moves to the other side when the grown content fits there whole", async () => {
			const { positioner, popupRect, grow } = await setup(lowAnchorTop(), SMALL);
			await expect.element(positioner).toHaveAttribute("data-side", "bottom");

			// Too tall for the room below, short enough for the room above.
			const height = Math.round(window.innerHeight * 0.5);
			grow(height);

			await expect.element(positioner).toHaveAttribute("data-side", "top");
			expect(Math.abs(popupRect().height - height)).toBeLessThan(1.5);
		});
	});
});
