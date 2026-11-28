// The accessibility tree of Switch on a page, in each state a user meets it in.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";

import SwitchPage from "./fixtures/switch-page.svelte";

describe("Switch accessibility tree", () => {
	it("shows unchecked switches, each named by its label", async () => {
		const screen = await render(SwitchPage);
		await expect.element(screen.locator).toMatchAriaInlineSnapshot(`
			- text: first
			- switch "first"
			- text: second
			- switch "second"
			- text: third
			- switch "third"
			- switch "Notifications"
			- text: Notifications
		`);
	});

	it("shows the checked state", async () => {
		const screen = await render(SwitchPage, { defaultChecked: true });
		await expect.element(screen.locator).toMatchAriaInlineSnapshot(`
			- text: first
			- switch "first" [checked]
			- text: second
			- switch "second" [checked]
			- text: third
			- switch "third" [checked]
			- switch "Notifications" [checked]
			- text: Notifications
		`);
	});

	it("shows the disabled state", async () => {
		const screen = await render(SwitchPage, { disabled: true });
		await expect.element(screen.locator).toMatchAriaInlineSnapshot(`
			- text: first
			- switch "first" [disabled]
			- text: second
			- switch "second" [disabled]
			- text: third
			- switch "third" [disabled]
			- switch "Notifications" [disabled]
			- text: Notifications
		`);
	});

	it("shows read-only switches as the unchecked ones", async () => {
		const screen = await render(SwitchPage, { readOnly: true });
		await expect.element(screen.locator).toMatchAriaInlineSnapshot(`
			- text: first
			- switch "first"
			- text: second
			- switch "second"
			- text: third
			- switch "third"
			- switch "Notifications"
			- text: Notifications
		`);
	});

	it("shows required switches as the unchecked ones", async () => {
		const screen = await render(SwitchPage, { required: true });
		await expect.element(screen.locator).toMatchAriaInlineSnapshot(`
			- text: first
			- switch "first"
			- text: second
			- switch "second"
			- text: third
			- switch "third"
			- switch "Notifications"
			- text: Notifications
		`);
	});
});
