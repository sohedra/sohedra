// The focus guards around the trigger of a hover-opened popover. Such a popover takes no focus,
// so its popup renders no focus guards, and the trigger's own guards would have nothing to hand
// focus to: Tab would stop on one of them, an element nobody can see. The trigger renders no
// guards while a hover holds the popover open, and Tab follows the document's own order.
// - The fixture is the Popover of the focus manager cases with `openOnHover` on its trigger and
//   a `before` and an `after` button around it.
import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import FocusPopover from "./fixtures/focus-popover.svelte";

const GUARD = "data-sohedra-focus-guard";

describe("the trigger of a hover-opened popover", () => {
	async function setup() {
		const onOpenChange = vi.fn();
		const screen = await render(FocusPopover, {
			rootProps: { onOpenChange },
			triggerProps: { openOnHover: true, delay: 0 },
			before: true,
			after: true,
		});
		const trigger = screen.getByTestId("anchor");
		const popup = screen.getByTestId("popup");
		await userEvent.hover(trigger);
		await expect.poll(() => popup.query()).not.toBe(null);
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
		onOpenChange.mockClear();
		return { screen, trigger, popup, onOpenChange };
	}

	it("lets Tab go from the trigger to the element after it", async () => {
		const { screen, trigger, popup } = await setup();
		trigger.element().focus();

		await userEvent.tab();

		await expect.element(screen.getByTestId("after")).toHaveFocus();
		expect(popup.query()).not.toBe(null);
	});

	it("lets Shift+Tab go from the element after the trigger onto the trigger", async () => {
		const { screen, trigger, popup } = await setup();
		screen.getByTestId("after").element().focus();

		await userEvent.tab({ shift: true });

		await expect.element(trigger).toHaveFocus();
		expect(popup.query()).not.toBe(null);
	});

	it("lets Shift+Tab go from the trigger to the element before it, and stays open", async () => {
		const { screen, trigger, popup, onOpenChange } = await setup();
		trigger.element().focus();

		await userEvent.tab({ shift: true });

		await expect.element(screen.getByTestId("before")).toHaveFocus();
		// The pointer still holds it open: only its leaving closes a hover-opened popover.
		expect(popup.query()).not.toBe(null);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("renders no focus guards around the trigger", async () => {
		const { trigger } = await setup();
		const element = trigger.element();

		expect(element.previousElementSibling?.hasAttribute(GUARD)).not.toBe(true);
		expect(element.nextElementSibling?.hasAttribute(GUARD)).not.toBe(true);
	});

	it("carries Tab into the popup again once a click holds the popover open", async () => {
		const { screen, trigger } = await setup();
		const child = screen.getByTestId("child");
		// A click right after the hover-open keeps the popover open and gives it focus management.
		await userEvent.click(trigger);
		await expect.element(child).toHaveFocus();
		trigger.element().focus();

		await userEvent.tab();

		await expect.element(child).toHaveFocus();
	});
});
