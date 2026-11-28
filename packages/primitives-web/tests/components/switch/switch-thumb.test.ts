// Switch.Thumb: the root's state on the thumb, inside the root and inside its render snippet, and
// the error outside a root.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import SwitchThumb from "#lib/components/switch/switch-thumb.svelte";

import SwitchDemo from "./fixtures/switch-demo.svelte";
import SwitchThumbInRender from "./fixtures/switch-thumb-in-render.svelte";

describe("Switch.Thumb", () => {
	it("throws a descriptive error when rendered outside Switch.Root", async () => {
		// Svelte's dev build appends the component stack to the message.
		await expect(render(SwitchThumb)).rejects.toThrow(
			"Sohedra: <Switch.Thumb> must be placed within <Switch.Root>.",
		);
	});

	it("reads the root's state when rendered inside the root's render snippet", async () => {
		const screen = await render(SwitchThumbInRender);
		const root = screen.getByRole("switch");
		const thumb = screen.getByTestId("thumb");
		await expect.element(root).toHaveAttribute("data-snippet-checked", "false");
		await expect.element(thumb).toHaveAttribute("data-unchecked");

		await userEvent.click(root);
		await expect.element(root).toHaveAttribute("aria-checked", "true");
		await expect.element(root).toHaveAttribute("data-snippet-checked", "true");
		await expect.element(thumb).toHaveAttribute("data-checked");
		await expect.element(thumb).not.toHaveAttribute("data-unchecked");
	});

	it("mirrors the root's data attributes", async () => {
		const screen = await render(SwitchDemo, { thumb: true });
		const thumb = screen.getByTestId("thumb");
		await expect.element(thumb).toHaveAttribute("data-unchecked");
		await expect.element(thumb).not.toHaveAttribute("data-checked");
		await expect.element(thumb).not.toHaveAttribute("data-disabled");

		await screen.rerender({ checked: true, disabled: true, readOnly: true, required: true });
		await expect.element(thumb).toHaveAttribute("data-checked");
		await expect.element(thumb).not.toHaveAttribute("data-unchecked");
		await expect.element(thumb).toHaveAttribute("data-disabled");
		await expect.element(thumb).toHaveAttribute("data-readonly");
		await expect.element(thumb).toHaveAttribute("data-required");
	});

	it("follows the root when the user toggles it", async () => {
		const screen = await render(SwitchDemo, { thumb: true });
		const thumb = screen.getByTestId("thumb");
		await expect.element(thumb).toHaveAttribute("data-unchecked");

		await userEvent.click(screen.getByRole("switch"));

		await expect.element(thumb).toHaveAttribute("data-checked");
	});
});
