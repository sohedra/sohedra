// Positioning follows changes made while a popover is open: a moved trigger moves the modal
// backdrop's cut-out, and changed collision options recompute the position.

import { describe, expect, it } from "vitest";

import { act, createRenderer, fireEvent, screen, waitFor } from "../../shim/index.js";
import PositionerPopover from "./fixtures/popover-positioner.svelte";
import PartTriggerPopover from "./fixtures/popover-trigger.svelte";

/** One frame, then one task: a recompute's `computePosition` has resolved by then. */
function afterRecompute() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => setTimeout(resolve));
	});
}

function internalBackdrop() {
	const backdrop = document.querySelector<HTMLElement>('[role="presentation"][data-sohedra-inert]');
	if (!backdrop) {
		throw new Error("no internal backdrop");
	}
	return backdrop;
}

describe("Popover positioning updates", () => {
	const { render } = createRenderer();

	it("moves the modal backdrop's trigger cut-out when the trigger moves while open", async () => {
		await render(PartTriggerPopover, {
			rootProps: { modal: true },
			triggerText: "Open",
			content: "Content",
		});
		const trigger = screen.getByRole("button", { name: "Open" });
		fireEvent.click(trigger);
		await waitFor(() => {
			expect(internalBackdrop().style.clipPath).toContain(
				`${trigger.getBoundingClientRect().left}px`,
			);
		});

		await act(async () => {
			trigger.style.marginLeft = "173px";
			window.dispatchEvent(new Event("resize"));
		});

		const { left } = trigger.getBoundingClientRect();
		await waitFor(() => {
			expect(internalBackdrop().style.clipPath).toContain(`${left}px`);
		});
	});

	it("recomputes when collisionAvoidance changes while open", async () => {
		const { setProps } = await render(PositionerPopover, {
			triggerStyle: "position: fixed; bottom: 10px; left: 100px; width: 100px; height: 20px",
			popupStyle: "width: 100px; height: 100px",
			// No anchor tracking: only the option change itself can recompute.
			positionerProps: { disableAnchorTracking: true },
		});
		const positioner = screen.getByTestId("positioner");
		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "top");
		});

		await setProps({
			positionerProps: { disableAnchorTracking: true, collisionAvoidance: { side: "none" } },
		});
		await afterRecompute();

		expect(positioner).toHaveAttribute("data-side", "bottom");
	});

	it("recomputes when collisionBoundary changes while open", async () => {
		const { setProps } = await render(PositionerPopover, {
			triggerStyle: "position: fixed; top: 200px; left: 100px; width: 100px; height: 20px",
			popupStyle: "width: 100px; height: 100px",
			// No anchor tracking: only the option change itself can recompute.
			positionerProps: { disableAnchorTracking: true },
		});
		const positioner = screen.getByTestId("positioner");
		await waitFor(() => {
			expect(positioner).toHaveAttribute("data-side", "bottom");
		});

		// A boundary ending just below the trigger leaves no room underneath.
		await setProps({
			positionerProps: {
				disableAnchorTracking: true,
				collisionBoundary: { x: 0, y: 0, width: 1000, height: 230 },
			},
		});
		await afterRecompute();

		expect(positioner).toHaveAttribute("data-side", "top");
	});
});
