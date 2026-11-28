// Accessibility checks (axe-core) for Popover with every part: closed, open (non-modal, modal with
// a backdrop, focus-trapping) and opened by hover.

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { expectNoAxeViolations } from "../../axe.js";
import AxePopover from "./fixtures/popover-axe.svelte";

describe("Popover axe", () => {
	it("has no violations closed", async () => {
		await render(AxePopover);
		await expect.element(page.getByRole("button", { name: "Notifications" })).toBeVisible();
		await expectNoAxeViolations();
	});

	it.each([
		["non-modal", {}],
		["modal, with a backdrop", { modal: true }],
		["trapping focus", { modal: "trap-focus" as const }],
	])("has no violations open %s", async (_name, props) => {
		await render(AxePopover, props);
		await userEvent.click(page.getByRole("button", { name: "Notifications" }));
		await expect.element(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
		await expectNoAxeViolations();
	});

	it("has no violations opened by hover", async () => {
		await render(AxePopover, { openOnHover: true });
		await userEvent.hover(page.getByRole("button", { name: "Notifications" }));
		await expect.element(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
		await expectNoAxeViolations();
	});
});
