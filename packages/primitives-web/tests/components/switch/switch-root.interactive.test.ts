// A click dispatched by script at the hidden input of a switch that is not interactive changes
// nothing and calls no callback.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

import SwitchRoot from "#lib/components/switch/switch-root.svelte";

function hiddenInput() {
	return document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
}

function clickHiddenInput() {
	hiddenInput().dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("Switch.Root hidden input click while not interactive", () => {
	it.each([["disabled"], ["readOnly"]] as const)("changes nothing when %s", async (key) => {
		const onCheckedChange = vi.fn();
		const screen = await render(SwitchRoot, { [key]: true, onCheckedChange });
		const root = screen.getByRole("switch");

		clickHiddenInput();

		expect(onCheckedChange).not.toHaveBeenCalled();
		await expect.element(root).toHaveAttribute("aria-checked", "false");
		// The event is not cancelable, so the browser's toggle is not undone by `preventDefault()`:
		// the input is set back to the control's value.
		expect(hiddenInput().checked).toBe(false);
	});

	it("still toggles when it is neither", async () => {
		const onCheckedChange = vi.fn();
		const screen = await render(SwitchRoot, { onCheckedChange });

		clickHiddenInput();

		expect(onCheckedChange).toHaveBeenCalledTimes(1);
		await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
		expect(hiddenInput().checked).toBe(true);
	});
});
