// Popover.Popup's names: the Title labels it and the Description describes it.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import PopoverDemo from "./fixtures/popover-demo.svelte";

describe("Popover.Popup", () => {
	it("is labelled by the Title's id", async () => {
		await render(PopoverDemo, { open: true, title: "Title" });

		const id = page.getByText("Title").element().id;
		await expect.element(page.getByRole("dialog")).toHaveAttribute("aria-labelledby", id);
	});

	it("is described by the Description's id", async () => {
		await render(PopoverDemo, { open: true, description: "Description" });

		const id = page.getByText("Description").element().id;
		await expect.element(page.getByRole("dialog")).toHaveAttribute("aria-describedby", id);
	});
});
