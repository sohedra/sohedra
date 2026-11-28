// How Popover closes: Escape and a press outside, and an outside press that a virtual click makes
// after a touch session.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { dispatch } from "../../kit/kit-events.js";
import PopoverDemo from "./fixtures/popover-demo.svelte";

describe("Popover dismissal", () => {
	it("opens on click and closes on Escape and outside click", async () => {
		await render(PopoverDemo, {
			title: "Title",
			description: "Description",
			outsideButton: "Outside",
		});
		const trigger = page.getByRole("button", { name: "Toggle" });
		expect(page.getByRole("dialog").query()).toBe(null);
		await userEvent.click(trigger);
		await expect.element(page.getByRole("dialog")).toBeInTheDocument();
		const dialog = page.getByRole("dialog").element();
		expect(dialog.textContent).toContain("Content");
		await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
		expect(trigger.element().getAttribute("aria-controls")).toBe(dialog.id);
		expect(dialog.getAttribute("aria-labelledby")).toBe(page.getByText("Title").element().id);
		expect(dialog.closest("[data-sohedra-portal]")?.parentElement).toBe(document.body);
		await userEvent.keyboard("{Escape}");
		await expect.poll(() => page.getByRole("dialog").query()).toBe(null);
		await userEvent.click(trigger);
		await expect.element(page.getByRole("dialog")).toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "Outside" }));
		await expect.poll(() => page.getByRole("dialog").query()).toBe(null);
	});

	it("dismisses a keyboard-reopened popup on a virtual outside click after a touch session", async () => {
		await render(PopoverDemo, {
			variant: "detached",
			triggers: ["Trigger"],
			outsideButton: "Outside",
		});

		const trigger = page.getByRole("button", { name: "Trigger" });
		await userEvent.click(trigger);
		await expect.element(page.getByRole("dialog")).toBeInTheDocument();
		const popup = page.getByRole("dialog").element();

		// No browser here emulates a touch pointer: the tap is dispatched with its pointer type.
		dispatch(popup, "pointerdown", { pointerType: "touch", button: 0 });
		dispatch(popup, "pointerup", { pointerType: "touch", button: 0 });
		dispatch(popup, "click");
		await userEvent.keyboard("{Escape}");
		await expect.poll(() => page.getByRole("dialog").query()).toBe(null);

		// Escape returned focus to the trigger, where Enter reopens it.
		await expect.element(trigger).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("dialog")).toBeInTheDocument();

		// A virtual click (a screen reader's, `detail: 0`) has no pointerdown to replace the previous
		// session's touch type, and no real input here makes one.
		dispatch(page.getByRole("button", { name: "Outside" }), "click", { detail: 0 });
		await expect.poll(() => page.getByRole("dialog").query()).toBe(null);
	});
});
