// Popover.Trigger: the error without a root, the disabled trigger, the data attributes a press and
// a hover set, the keys of a trigger rendered as a <div>, and toggling contained and detached
// triggers.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { Popover } from "#lib/components/popover/index.js";

import PopoverDemo from "./fixtures/popover-demo.svelte";

describe("Popover.Trigger", () => {
	it("throws a descriptive error when rendered without a root or a handle", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(render(Popover.Trigger as never)).rejects.toThrow(
				"Sohedra: <Popover.Trigger> must be placed within <Popover.Root> or given a handle.",
			);
		} finally {
			errorSpy.mockRestore();
		}
	});

	describe("prop: disabled", () => {
		it("disables the popover", async () => {
			await render(PopoverDemo, { triggerProps: { disabled: true }, content: "Content" });

			const trigger = page.getByRole("button");
			await expect.element(trigger).toHaveAttribute("disabled");
			await expect.element(trigger).toHaveAttribute("data-disabled");

			// `force`: a real pointer presses the disabled button instead of waiting for it.
			await userEvent.click(trigger, { force: true });
			expect(page.getByText("Content").query()).toBe(null);

			await userEvent.tab();
			expect(document.activeElement).not.toBe(trigger.element());
		});

		it("disables a trigger rendered as another element with aria-disabled", async () => {
			await render(PopoverDemo, {
				triggerProps: { disabled: true, nativeButton: false },
				triggerAs: "span",
				content: "Content",
			});

			const trigger = page.getByRole("button");
			await expect.element(trigger).not.toHaveAttribute("disabled");
			await expect.element(trigger).toHaveAttribute("data-disabled");
			await expect.element(trigger).toHaveAttribute("aria-disabled", "true");

			// `force`: a real pointer presses the aria-disabled element instead of waiting for it.
			await userEvent.click(trigger, { force: true });
			expect(page.getByText("Content").query()).toBe(null);

			await userEvent.tab();
			expect(document.activeElement).not.toBe(trigger.element());
		});

		it("does not open on hover when disabled", async () => {
			await render(PopoverDemo, {
				triggerProps: { disabled: true, openOnHover: true, delay: 0, nativeButton: false },
				triggerAs: "span",
				content: "Content",
			});

			const trigger = page.getByRole("button");
			await expect.element(trigger).toHaveAttribute("data-disabled");

			await userEvent.hover(trigger);

			expect(page.getByText("Content").query()).toBe(null);
			await expect.element(trigger).not.toHaveAttribute("data-popup-open");
		});
	});

	describe("style hooks", () => {
		it("sets data-popup-open and data-pressed when opened by a press", async () => {
			await render(PopoverDemo, { portal: false });

			const trigger = page.getByRole("button", { name: "Toggle" });
			await userEvent.click(trigger);

			await expect.element(trigger).toHaveAttribute("data-popup-open");
			await expect.element(trigger).toHaveAttribute("data-pressed");
		});

		it("sets data-popup-open but not data-pressed when opened by hover", async () => {
			await render(PopoverDemo, { triggerProps: { openOnHover: true, delay: 0 } });

			const trigger = page.getByRole("button", { name: "Toggle" });
			await userEvent.hover(trigger);

			await expect.element(trigger).toHaveAttribute("data-popup-open");
			await expect.element(trigger).not.toHaveAttribute("data-pressed");
		});

		it("stays open when pressed right after a hover opened it with no delay", async () => {
			await render(PopoverDemo, { triggerProps: { delay: 0, openOnHover: true } });

			const trigger = page.getByRole("button", { name: "Toggle" });
			await userEvent.hover(trigger);
			await userEvent.click(trigger);

			await expect.element(trigger).toHaveAttribute("data-popup-open");
		});

		it("sets data-popup-open and data-pressed when pressed before the hover delay ends", async () => {
			await render(PopoverDemo, { triggerProps: { openOnHover: true } });

			const trigger = page.getByRole("button", { name: "Toggle" });
			await userEvent.hover(trigger);
			await userEvent.click(trigger);

			await expect.element(trigger).toHaveAttribute("data-popup-open");
			await expect.element(trigger).toHaveAttribute("data-pressed");
		});
	});

	it("toggles closed with Enter or Space when rendering a <div>", async () => {
		await render(PopoverDemo, {
			triggerProps: { nativeButton: false },
			triggerAs: "div",
			content: "Content",
			outsideButton: "Other button",
		});

		const trigger = page.getByRole("button", { name: "Toggle" }).element();

		// Initial focus moves into the popup a frame after opening: wait for it before Shift+Tab, or
		// the keypress races it (WebKit).
		const waitForPopupFocus = () =>
			vi.waitFor(() => {
				expect(document.activeElement).toBe(page.getByText("Content").element());
			});

		await userEvent.tab();
		await userEvent.keyboard("{Enter}");
		expect(page.getByText("Content").query()).not.toBe(null);

		await waitForPopupFocus();
		await userEvent.tab({ shift: true });
		expect(document.activeElement).toBe(trigger);

		await userEvent.keyboard("{Enter}");
		await expect.poll(() => page.getByText("Content").query()).toBe(null);

		await userEvent.keyboard("{Enter}");
		expect(page.getByText("Content").query()).not.toBe(null);

		await waitForPopupFocus();
		await userEvent.tab({ shift: true });
		expect(document.activeElement).toBe(trigger);

		await userEvent.keyboard("[Space]");
		expect(page.getByText("Content").query()).toBe(null);

		await userEvent.keyboard("[Space]");
		expect(page.getByText("Content").query()).not.toBe(null);

		await waitForPopupFocus();
		await userEvent.tab({ shift: true });
		expect(document.activeElement).toBe(trigger);

		await userEvent.keyboard("[Space]");
		expect(page.getByText("Content").query()).toBe(null);
	});

	it.each([
		{ variant: "contained", count: 1, triggers: ["Toggle"] },
		{ variant: "detached", count: 1, triggers: ["Toggle"] },
		{ variant: "detached", count: 2, triggers: ["Toggle", "Toggle another"] },
	] as const)(
		"toggles a $variant popover with $count trigger(s)",
		async ({ variant, triggers }) => {
			await render(PopoverDemo, { variant, triggers: [...triggers] });
			const trigger = page.getByRole("button", { name: "Toggle", exact: true });
			await userEvent.click(trigger);
			await expect.element(page.getByRole("dialog")).toBeVisible();
			await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
			await userEvent.click(trigger);
			await expect.poll(() => page.getByRole("dialog").query()).toBe(null);
		},
	);
});
