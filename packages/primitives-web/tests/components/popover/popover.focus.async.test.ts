// Popover's initial focus when the popup's content arrives after it opens, in Svelte's async mode
// (the sync run leaves this file out): initial focus is resolved once, a microtask after the open,
// so content that appears later doesn't take focus.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import PopoverLateContent from "./fixtures/popover-late-content.svelte";

describe("Popover initial focus with content that arrives after open", () => {
	it("focuses the popup when its only tabbable element hasn't arrived yet", async () => {
		const content = Promise.withResolvers<string>();
		await render(PopoverLateContent, { promise: content.promise });

		await userEvent.click(page.getByTestId("trigger"));
		const popup = page.getByTestId("popup");
		await expect.element(popup).toHaveFocus();

		content.resolve("Late");
		await expect.element(page.getByTestId("late-button")).toBeInTheDocument();

		// Focus stays where the open put it; the content is a Tab away.
		await expect.element(popup).toHaveFocus();
		await userEvent.tab();
		await expect.element(page.getByTestId("late-button")).toHaveFocus();
	});

	it("falls back to the popup when the `initialFocus` target hasn't arrived yet", async () => {
		const content = Promise.withResolvers<string>();
		await render(PopoverLateContent, { promise: content.promise, focusLate: true });

		await userEvent.click(page.getByTestId("trigger"));
		const popup = page.getByTestId("popup");
		await expect.element(popup).toHaveFocus();

		content.resolve("Late");
		await expect.element(page.getByTestId("late-button")).toBeInTheDocument();

		// While pending, the target already exists off the document, so `initialFocus` returns it but
		// it can't take focus: the popup does. `initialFocus` is resolved once per open, so the target
		// doesn't take focus when it arrives either.
		await expect.element(popup).toHaveFocus();
	});

	it("focuses the `initialFocus` target when the content is already there", async () => {
		const content = Promise.withResolvers<string>();
		content.resolve("Ready");
		await render(PopoverLateContent, { promise: content.promise, focusLate: true });

		await userEvent.click(page.getByTestId("trigger"));

		await expect.element(page.getByTestId("late-button")).toHaveFocus();
	});
});
