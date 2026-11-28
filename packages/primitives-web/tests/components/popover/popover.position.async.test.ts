// Popover's positioning when the popup's content arrives after it opens, in Svelte's async mode
// (the sync run leaves this file out): the popup stays anchored as it grows.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import PopoverLateContent from "./fixtures/popover-late-content.svelte";

describe("Popover.Positioner with content that arrives after open", () => {
	it("keeps the popup anchored as the content grows", async () => {
		const content = Promise.withResolvers<string>();
		await render(PopoverLateContent, {
			promise: content.promise,
			positioner: { side: "top", sideOffset: 0 },
			triggerStyle: "margin-top: 400px",
		});
		const trigger = page.getByTestId("trigger").element();

		await userEvent.click(trigger);
		await expect.element(page.getByTestId("popup")).toBeInTheDocument();
		const popup = page.getByTestId("popup").element();
		await vi.waitFor(() => {
			expect(popup.getBoundingClientRect().bottom).toBeCloseTo(
				trigger.getBoundingClientRect().top,
				0,
			);
		});
		const pendingHeight = popup.getBoundingClientRect().height;

		content.resolve("Late");
		await expect.element(page.getByTestId("late-button")).toBeInTheDocument();

		// The popup grew upwards: its bottom edge still meets the trigger, and it stays on screen.
		await vi.waitFor(() => {
			expect(popup.getBoundingClientRect().height).toBeGreaterThan(pendingHeight);
			expect(popup.getBoundingClientRect().bottom).toBeCloseTo(
				trigger.getBoundingClientRect().top,
				0,
			);
		});
		expect(popup.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
	});
});
