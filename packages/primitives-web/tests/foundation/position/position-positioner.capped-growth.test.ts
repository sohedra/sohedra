// New cases: a popup capped to the space it has (`max-height: var(--available-height)`) whose
// content grows while it is open, until it fits on neither side. Opened with that content it
// goes to the side with more room; grown into it, it has to end there too.
// - The popup is fixtures/position-capped-growing.svelte: asked for below its anchor, which sits
//   below the middle of the viewport, so there is more room above. The collision padding is the
//   default 5 pixels.

import { describe, expect, it } from "vitest";

import { act, createRenderer, screen, waitFor } from "../../shim/index.js";
import CappedGrowingPopover from "./fixtures/position-capped-growing.svelte";

const PADDING = 5;
const ANCHOR_HEIGHT = 20;
const SMALL = 40;
const HUGE = 5000;

describe("a capped popup that grows while open", () => {
	const { render } = createRenderer();

	/** The anchor's top edge: below the middle, so the larger side is above it. */
	const lowAnchorTop = () => Math.round(window.innerHeight * 0.6);
	/** Above the middle: the larger side is the requested one, below. */
	const highAnchorTop = () => Math.round(window.innerHeight * 0.3);

	async function setup(anchorTop: number, contentHeight: number) {
		const { component } = await render(CappedGrowingPopover, { anchorTop, contentHeight });
		const positioner = screen.getByTestId("positioner");
		const popup = screen.getByTestId("popup");
		const grow = async (height: number) => {
			await act(async () => component.setContentHeight(height));
		};
		return { component, positioner, popup, grow };
	}

	it("moves to the side with more room when its content outgrows both sides", async () => {
		const anchorTop = lowAnchorTop();
		const { positioner, popup, grow } = await setup(anchorTop, SMALL);
		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "bottom");
		});

		await grow(HUGE);

		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "top");
		});
		// It fills the room above the anchor, down to the anchor's edge.
		await waitFor(() => {
			const rect = popup.getBoundingClientRect();
			expect(Math.abs(rect.height - (anchorTop - PADDING))).toBeLessThan(1.5);
			expect(Math.abs(rect.bottom - anchorTop)).toBeLessThan(1.5);
		});
	});

	it("ends on the same side as a popup opened with that content", async () => {
		const anchorTop = lowAnchorTop();
		const { component, positioner, grow } = await setup(anchorTop, SMALL);
		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "bottom");
		});
		await grow(HUGE);
		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "top");
		});

		await act(async () => component.setOpen(false));
		await waitFor(() => {
			expect(screen.queryByTestId("positioner")).toBe(null);
		});
		await act(async () => component.setOpen(true));

		await waitFor(() => {
			expect(screen.getByTestId("positioner")).toHaveAttribute("data-side", "top");
		});
	});

	it("opens on the side with more room when the content fits neither", async () => {
		const { positioner } = await setup(lowAnchorTop(), HUGE);

		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "top");
		});
	});

	it("stays on the requested side when that is the one with more room", async () => {
		const anchorTop = highAnchorTop();
		const { positioner, popup, grow } = await setup(anchorTop, SMALL);
		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "bottom");
		});

		await grow(HUGE);

		const room = window.innerHeight - (anchorTop + ANCHOR_HEIGHT) - PADDING;
		await waitFor(() => {
			expect(Math.abs(popup.getBoundingClientRect().height - room)).toBeLessThan(1.5);
		});
		expect(positioner).toHaveAttribute("data-side", "bottom");
	});

	it("moves to the other side when the grown content fits there whole", async () => {
		const anchorTop = lowAnchorTop();
		const { positioner, popup, grow } = await setup(anchorTop, SMALL);
		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "bottom");
		});

		// Too tall for the room below, short enough for the room above.
		const height = Math.round(window.innerHeight * 0.5);
		await grow(height);

		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "top");
		});
		expect(Math.abs(popup.getBoundingClientRect().height - height)).toBeLessThan(1.5);
	});
});
