// Popover.Popup with content that arrives after it opens, in Svelte's async mode (the sync run
// leaves this file out): with a `<svelte:boundary>` and a `pending` snippet the popup opens right
// away and the content appears later, and a Description still loading names nothing.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import PopoverLateContent from "./fixtures/popover-late-content.svelte";
import PopoverLateDescription from "./fixtures/popover-late-description.svelte";

describe("Popover.Popup with content that arrives after open", () => {
	it("opens right away with the pending content, then shows the content", async () => {
		const content = Promise.withResolvers<string>();
		await render(PopoverLateContent, { promise: content.promise });

		await userEvent.click(page.getByTestId("trigger"));

		await expect.element(page.getByTestId("popup")).toHaveAttribute("data-open");
		await expect.element(page.getByTestId("pending")).toBeVisible();
		expect(page.getByTestId("late-content").query()).toBe(null);

		content.resolve("Late");

		await expect.element(page.getByTestId("late-button")).toHaveTextContent("Late");
		expect(page.getByTestId("pending").query()).toBe(null);
		await expect.element(page.getByTestId("popup")).toHaveAttribute("data-open");
	});

	// While it loads in a pending boundary the Description isn't in the document, so it claims no id.
	it("doesn't point `aria-describedby` at a Description that is still loading", async () => {
		const content = Promise.withResolvers<string>();
		await render(PopoverLateDescription, { promise: content.promise });

		await userEvent.click(page.getByTestId("trigger"));
		const popup = page.getByTestId("popup");
		await expect.element(page.getByTestId("pending")).toBeInTheDocument();
		await expect
			.element(popup)
			.toHaveAttribute("aria-labelledby", page.getByTestId("title").element().id);
		await expect.element(popup).not.toHaveAttribute("aria-describedby");

		content.resolve("Bio");

		await expect.element(page.getByTestId("description")).toBeInTheDocument();
		await expect
			.element(popup)
			.toHaveAttribute("aria-describedby", page.getByTestId("description").element().id);
	});
});
