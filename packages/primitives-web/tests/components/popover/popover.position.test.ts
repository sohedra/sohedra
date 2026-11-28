// Popover's positioning: where the popup goes, and what follows changes made while it is open (a
// moved trigger, changed collision options, inline styles set by others).
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import PopoverDemo from "./fixtures/popover-demo.svelte";

function internalBackdrop() {
	const backdrop = document.querySelector<HTMLElement>('[role="presentation"][data-sohedra-inert]');
	if (!backdrop) {
		throw new Error("no internal backdrop");
	}
	return backdrop;
}

describe("Popover.Positioner", () => {
	it("positions the popup below the trigger", async () => {
		await render(PopoverDemo, { title: "Title" });
		await userEvent.click(page.getByRole("button", { name: "Toggle" }));
		await expect.element(page.getByRole("dialog")).toBeVisible();
		const positioner = page.getByRole("dialog").element().parentElement!;
		await vi.waitFor(() => expect(positioner.style.transform).toMatch(/translate/));
		expect(positioner).toHaveAttribute("data-side", "bottom");
		expect(positioner.style.getPropertyValue("--transform-origin")).not.toBe("");
	});

	it("keeps an inline property set by others when its position updates", async () => {
		const screen = await render(PopoverDemo, {
			rootProps: { defaultOpen: true },
			positionerProps: { sideOffset: 0 },
		});
		// The position is a transform once positioned.
		const positioner = await vi.waitFor(() => {
			const element = page.getByTestId("positioner").element() as HTMLElement;
			expect(element.style.getPropertyValue("transform")).not.toBe("");
			return element;
		});
		const transform = positioner.style.getPropertyValue("transform");
		positioner.style.setProperty("--accent", "red");

		await screen.rerender({ positionerProps: { sideOffset: 20 } });

		await vi.waitFor(() =>
			expect(positioner.style.getPropertyValue("transform")).not.toBe(transform),
		);
		expect(positioner.style.getPropertyValue("--accent")).toBe("red");
	});

	it("moves the modal backdrop's trigger cut-out when the trigger moves while open", async () => {
		await render(PopoverDemo, { rootProps: { modal: true }, triggers: ["Open"] });
		const trigger = page.getByRole("button", { name: "Open" }).element() as HTMLElement;
		await userEvent.click(trigger);
		await vi.waitFor(() => {
			expect(internalBackdrop().style.clipPath).toContain(
				`${trigger.getBoundingClientRect().left}px`,
			);
		});

		trigger.style.marginLeft = "173px";
		// A layout change without a resize of the viewport: the resize the positioning listens to.
		window.dispatchEvent(new Event("resize"));

		const { left } = trigger.getBoundingClientRect();
		await vi.waitFor(() => {
			expect(internalBackdrop().style.clipPath).toContain(`${left}px`);
		});
	});

	it("recomputes when collisionAvoidance changes while open", async () => {
		const screen = await render(PopoverDemo, {
			open: true,
			triggerProps: {
				style: "position: fixed; bottom: 10px; left: 100px; width: 100px; height: 20px",
			},
			popupProps: { style: "width: 100px; height: 100px" },
			// No anchor tracking: only the option change itself can recompute.
			positionerProps: { disableAnchorTracking: true },
		});
		const positioner = page.getByTestId("positioner");
		await expect.element(positioner).toHaveAttribute("data-side", "top");

		await screen.rerender({
			positionerProps: { disableAnchorTracking: true, collisionAvoidance: { side: "none" } },
		});

		await expect.element(positioner).toHaveAttribute("data-side", "bottom");
	});

	it("recomputes when collisionBoundary changes while open", async () => {
		const screen = await render(PopoverDemo, {
			open: true,
			triggerProps: {
				style: "position: fixed; top: 200px; left: 100px; width: 100px; height: 20px",
			},
			popupProps: { style: "width: 100px; height: 100px" },
			// No anchor tracking: only the option change itself can recompute.
			positionerProps: { disableAnchorTracking: true },
		});
		const positioner = page.getByTestId("positioner");
		await expect.element(positioner).toHaveAttribute("data-side", "bottom");

		// A boundary ending just below the trigger leaves no room underneath.
		await screen.rerender({
			positionerProps: {
				disableAnchorTracking: true,
				collisionBoundary: { x: 0, y: 0, width: 1000, height: 230 },
			},
		});

		await expect.element(positioner).toHaveAttribute("data-side", "top");
	});
});
