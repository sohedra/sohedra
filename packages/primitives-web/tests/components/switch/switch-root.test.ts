// Switch.Root on its own and beside native labels: where it starts, what it renders, and how a
// wrapping or a later label names and presses it.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import { hiddenInput } from "../../kit/kit-form.js";
import SwitchDemo from "./fixtures/switch-demo.svelte";
import SwitchRootInLabel from "./fixtures/switch-root-in-label.svelte";
import SwitchRootWithLabels from "./fixtures/switch-root-with-labels.svelte";

// An empty switch has no size, and userEvent only clicks visible elements.
const SIZED = "display: inline-block; width: 16px; height: 16px";

describe("Switch.Root", () => {
	it("starts from defaultChecked when checked isn't given", async () => {
		const screen = await render(SwitchDemo, { defaultChecked: true });
		await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
		expect(hiddenInput(screen.container).checked).toBe(true);
	});

	it("renders no text beside the switch", async () => {
		const screen = await render(SwitchDemo, { name: "switch-name", uncheckedValue: "off" });
		expect(screen.container.textContent).toBe("");
	});

	describe("with native labels", () => {
		it("toggles exactly once when the switch itself is clicked inside a wrapping <label>", async () => {
			const onCheckedChange = vi.fn();
			const screen = await render(SwitchRootInLabel, { onCheckedChange, style: SIZED });

			await userEvent.click(screen.getByRole("switch"));

			await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
			expect(hiddenInput(screen.container).checked).toBe(true);
			expect(onCheckedChange).toHaveBeenCalledTimes(1);
		});

		// A label mounted later is observed.
		it("names the switch by a native label mounted after it, and drops a removed one", async () => {
			const screen = await render(SwitchRootWithLabels, { labels: [], id: "late" });
			const root = screen.getByRole("switch");
			await expect.element(root).not.toHaveAttribute("aria-labelledby");

			await screen.rerender({ labels: [{ for: "late", text: "Late label" }], id: "late" });
			await expect.element(root).toHaveAccessibleName("Late label");

			await screen.rerender({ labels: [], id: "late" });
			await expect.element(root).not.toHaveAttribute("aria-labelledby");
		});
	});
});
