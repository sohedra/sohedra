// New cases: Tab around the trigger of a popover that a hover opened. Such a popover takes no
// focus, so its popup renders no focus guards; the trigger's own guards then had nothing to hand
// focus to, and Tab stopped on one of them, an element nobody can see. The trigger now renders
// no guards while a hover holds the popover open, and Tab follows the document's own order.
// - The fixture is the Popover of the focus manager cases with `openOnHover` on its trigger and
//   a `before` and an `after` button around it. The pointer is driven with `fireEvent`.

import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { describe, expect, it, vi } from "vitest";

import { act, createRenderer, fireEvent, screen, waitFor } from "../../shim/index.js";
import FfmPopover from "./fixtures/focus-popover.svelte";

const GUARD = "data-sohedra-focus-guard";

describe("the trigger of a hover-opened popover", () => {
	const { render } = createRenderer();

	async function setup() {
		const onOpenChange = vi.fn();
		const { user } = await render(FfmPopover, {
			rootProps: { onOpenChange },
			triggerProps: { openOnHover: true, delay: 0 },
			before: true,
			after: true,
		});
		const trigger = screen.getByTestId("reference");
		fireEvent.mouseEnter(trigger);
		fireEvent.mouseMove(trigger, { movementX: 10, movementY: 10 });
		await waitFor(() => {
			expect(screen.queryByTestId("floating")).not.toBe(null);
		});
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
		onOpenChange.mockClear();
		return { user, trigger, onOpenChange };
	}

	it("lets Tab go from the trigger to the element after it", async () => {
		const { user, trigger } = await setup();
		await act(async () => trigger.focus());

		await user.tab();

		expect(screen.getByTestId("after")).toHaveFocus();
		expect(screen.queryByTestId("floating")).not.toBe(null);
	});

	it("lets Shift+Tab go from the element after the trigger onto the trigger", async () => {
		const { user, trigger } = await setup();
		await act(async () => screen.getByTestId("after").focus());

		await user.tab({ shift: true });

		expect(trigger).toHaveFocus();
		expect(screen.queryByTestId("floating")).not.toBe(null);
	});

	it("lets Shift+Tab go from the trigger to the element before it, and stays open", async () => {
		const { user, trigger, onOpenChange } = await setup();
		await act(async () => trigger.focus());

		await user.tab({ shift: true });

		expect(screen.getByTestId("before")).toHaveFocus();
		// The pointer still holds it open: only its leaving closes a hover-opened popover.
		expect(screen.queryByTestId("floating")).not.toBe(null);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("renders no focus guards around the trigger", async () => {
		const { trigger } = await setup();

		expect(trigger.previousElementSibling?.hasAttribute(GUARD)).not.toBe(true);
		expect(trigger.nextElementSibling?.hasAttribute(GUARD)).not.toBe(true);
	});

	it("carries Tab into the popup again once a click holds the popover open", async () => {
		const { user, trigger } = await setup();
		// A click right after the hover-open keeps the popover open and gives it focus management.
		await user.click(trigger);
		await waitFor(() => {
			expect(screen.getByTestId("child")).toHaveFocus();
		});
		await act(async () => trigger.focus());

		await user.tab();

		expect(screen.getByTestId("child")).toHaveFocus();
	});
});
