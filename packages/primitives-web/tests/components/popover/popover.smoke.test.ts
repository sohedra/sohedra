import { describe, expect, it } from "vitest";

import { createRenderer, fireEvent, screen, waitFor } from "../../shim/index.js";
import BasicPopover from "./fixtures/popover-basic.svelte";
import TestPopover from "./fixtures/popover-test.svelte";

describe("Popover smoke", () => {
	const { render } = createRenderer();

	it("opens on click and closes on Escape and outside click", async () => {
		const { user } = await render(BasicPopover);
		const trigger = screen.getByTestId("trigger");
		expect(screen.queryByRole("dialog")).toBe(null);
		await user.click(trigger);
		const dialog = await screen.findByRole("dialog");
		expect(dialog.textContent).toContain("Content");
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
		expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByText("Title").id);
		expect(dialog.closest("[data-sohedra-portal]")?.parentElement).toBe(document.body);
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
		await user.click(trigger);
		await screen.findByRole("dialog");
		fireEvent.click(document.body);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
	});

	it("positions the popup", async () => {
		const { user } = await render(BasicPopover);
		await user.click(screen.getByTestId("trigger"));
		const dialog = await screen.findByRole("dialog");
		const positioner = dialog.parentElement!;
		await waitFor(() => expect(positioner.style.transform).toMatch(/translate/));
		expect(positioner).toHaveAttribute("data-side", "bottom");
		expect(positioner.style.getPropertyValue("--transform-origin")).not.toBe("");
	});

	it.each(["contained", "detached", "multiple"] as const)(
		"toggles the %s test popover",
		async (variant) => {
			const { user } = await render(TestPopover, { variant });
			const trigger = screen.getByRole("button", { name: "Toggle" });
			await user.click(trigger);
			await screen.findByTestId("popover-popup");
			expect(trigger).toHaveAttribute("aria-expanded", "true");
			await user.click(trigger);
			await waitFor(() => expect(screen.queryByTestId("popover-popup")).toBe(null));
		},
	);
});
