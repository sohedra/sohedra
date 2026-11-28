// Popover with every part on a page, in each state a user meets it in: no axe violations, and the
// accessibility tree.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { expectNoAxeViolations } from "../../kit/kit-axe.js";
import PopoverPage from "./fixtures/popover-page.svelte";

const trigger = () => page.getByRole("button", { name: "Notifications" });

describe("Popover axe", () => {
	it("has no violations closed", async () => {
		await render(PopoverPage);
		await expect.element(trigger()).toBeVisible();
		await expectNoAxeViolations();
	});

	it.each([
		["non-modal", {}],
		["modal, with a backdrop", { modal: true }],
		["trapping focus", { modal: "trap-focus" as const }],
	])("has no violations open %s", async (_name, props) => {
		await render(PopoverPage, props);
		await userEvent.click(trigger());
		await expect.element(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
		await expectNoAxeViolations();
	});

	it("has no violations opened by hover", async () => {
		await render(PopoverPage, { openOnHover: true });
		await userEvent.hover(trigger());
		await expect.element(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
		await expectNoAxeViolations();
	});
});

describe("Popover accessibility tree", () => {
	it("shows the closed trigger", async () => {
		await render(PopoverPage);
		await expect.element(page.elementLocator(document.body)).toMatchAriaInlineSnapshot(`
			- main:
			  - heading "Inbox" [level=1]
			  - button "Notifications"
		`);
	});

	it("shows the open popup, named by its Title and described", async () => {
		await render(PopoverPage);
		await userEvent.click(trigger());
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.elementLocator(document.body)).toMatchAriaInlineSnapshot(`
			- main:
			  - heading "Inbox" [level=1]
			  - button "Notifications" [expanded]
			  - dialog "Notifications":
			    - heading "Notifications" [level=2]
			    - paragraph: You are all caught up.
			    - button "Dismiss"
		`);
	});

	it("shows only the popup while a modal one is open", async () => {
		await render(PopoverPage, { modal: true });
		await userEvent.click(trigger());
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.elementLocator(document.body)).toMatchAriaInlineSnapshot(`
			- main:
			  - button "Notifications" [expanded]
			- dialog "Notifications":
			  - heading "Notifications" [level=2]
			  - paragraph: You are all caught up.
			  - button "Dismiss"
		`);
	});

	it("shows the popup opened by hover", async () => {
		await render(PopoverPage, { openOnHover: true });
		await userEvent.hover(trigger());
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect.element(page.elementLocator(document.body)).toMatchAriaInlineSnapshot(`
			- main:
			  - heading "Inbox" [level=1]
			  - button "Notifications" [expanded]
			- dialog "Notifications":
			  - heading "Notifications" [level=2]
			  - paragraph: You are all caught up.
			  - button "Dismiss"
		`);
	});
});
