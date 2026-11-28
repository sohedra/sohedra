// Popover's focus: Tab out of the popup, untabbable content after an outside press, and where
// focus returns when the popup closes.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import type { PopoverRootChangeEventDetails } from "#lib/components/popover/popover-types.js";

import { nextFrame } from "../../kit/kit-frames.js";
import PopoverDemo from "./fixtures/popover-demo.svelte";
import PopoverDisappearingTrigger from "./fixtures/popover-disappearing-trigger.svelte";
import PopoverProgrammaticOpen from "./fixtures/popover-programmatic-open.svelte";

/** Two frames, so queued focus handling and frame callbacks have run. */
async function twoFrames() {
	await nextFrame();
	await nextFrame();
}

describe("Popover focus", () => {
	it("calls `onOpenChange` once when Tab moves focus out of the popup", async () => {
		const onOpenChange = vi.fn<(open: boolean, details: PopoverRootChangeEventDetails) => void>();
		await render(PopoverDemo, {
			rootProps: { onOpenChange },
			title: "Title",
			description: "Description",
			close: "Close",
		});

		await userEvent.tab();
		await expect.element(page.getByRole("button", { name: "Toggle" })).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("button", { name: "Close" })).toHaveFocus();
		onOpenChange.mockClear();

		await userEvent.tab();
		await expect.poll(() => page.getByRole("dialog").query()).toBe(null);
		await twoFrames();

		// Only the trigger's focus guard closes it.
		expect(onOpenChange.mock.calls.map(([open, details]) => [open, details.reason])).toEqual([
			[false, "focus-out"],
		]);
		expect(onOpenChange.mock.calls[0][1].trigger).toHaveAttribute("data-sohedra-focus-guard");
	});

	// A press outside a non-modal popup makes its content untabbable until focus enters it again.
	it("keeps the popup's content untabbable when another detached trigger takes it over", async () => {
		await render(PopoverDemo, {
			variant: "detached",
			triggers: ["Trigger 1", "Trigger 2", "Trigger 3"],
			close: "Close",
		});

		await userEvent.click(page.getByRole("button", { name: "Trigger 1" }));
		await expect.element(page.getByRole("dialog")).toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "Trigger 2" }));
		await expect
			.element(page.getByRole("button", { name: "Trigger 2" }))
			.toHaveAttribute("aria-expanded", "true");
		await twoFrames();

		const close = page.getByRole("button", { name: "Close" }).element();
		expect(close).toHaveAttribute("tabindex", "-1");
		expect(close).toHaveAttribute("data-tabindex", "0");
		const insideGuards = document.querySelectorAll(
			'[data-sohedra-focus-guard][data-type="inside"]',
		);
		expect(insideGuards).toHaveLength(2);
		for (const guard of insideGuards) {
			expect(guard).toHaveAttribute("tabindex", "-1");
			expect(guard).toHaveAttribute("data-tabindex", "0");
		}
	});

	describe("with several triggers in the Root", () => {
		it("returns focus to the active trigger when opening programmatically from body focus", async () => {
			await render(PopoverProgrammaticOpen);

			const trigger1 = page.getByRole("button", { name: "Trigger 1" }).element() as HTMLElement;
			const trigger2 = page.getByRole("button", { name: "Trigger 2" }).element();

			await userEvent.click(trigger1);
			await userEvent.click(page.getByRole("button", { name: "Close" }));
			await expect.element(trigger1).toHaveFocus();

			// Focus leaves for the page itself, which no key or press reaches in every browser here.
			trigger1.blur();
			expect(document.body).toHaveFocus();

			await userEvent.click(page.getByRole("button", { name: "Open Trigger 2 without focus" }));
			await expect.element(page.getByTestId("content")).toBeVisible();

			await userEvent.click(page.getByRole("button", { name: "Close" }));
			await expect.element(trigger2).toHaveFocus();
		});

		it("returns focus to the previous element when the trigger unmounts while open", async () => {
			await render(PopoverDisappearingTrigger);

			const fallback = page.getByRole("button", { name: "Focus fallback" });
			// Tab, not a press: WebKit does not focus a pressed button.
			await userEvent.tab();
			await expect.element(fallback).toHaveFocus();

			await userEvent.click(page.getByRole("button", { name: "Disappearing trigger" }));
			await expect.element(page.getByTestId("content")).toBeVisible();

			await userEvent.click(page.getByRole("button", { name: "Close" }));
			await expect.poll(() => page.getByTestId("content").query()).toBe(null);
			await expect.element(fallback).toHaveFocus();
		});
	});
});
