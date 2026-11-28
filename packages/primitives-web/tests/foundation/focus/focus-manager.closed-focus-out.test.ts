// New cases: focus leaving the trigger of a popover that has already closed. The focus manager
// keeps listening while the closed popup is still mounted (an exit animation, or a close the app
// keeps mounted with `preventUnmountOnClose()`), and the close it queues when focus leaves runs
// a microtask later, so it used to report a `focus-out` close for a popup that was closed.
// - The fixture is the click-opened Popover of the other focus manager cases, with a `before`
//   and an `after` button around it.

import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { describe, expect, it, vi } from "vitest";

import type { PopoverRootChangeEventDetails } from "#lib/components/popover/popover-types.js";

import { act, createRenderer, screen, waitFor } from "../../shim/index.js";
import FfmPopover from "./fixtures/focus-popover.svelte";

const flushMicrotasks = () => act(async () => {});

type OpenChange = [open: boolean, details: PopoverRootChangeEventDetails];

/** The closes `onOpenChange` heard, as `[open, reason]`. */
function closes(onOpenChange: ReturnType<typeof vi.fn>) {
	return (onOpenChange.mock.calls as OpenChange[])
		.filter(([open]) => !open)
		.map(([open, details]) => [open, details.reason]);
}

describe("focus leaving the trigger of a closed popover", () => {
	const { render } = createRenderer();

	async function setup(onOpenChange: (...args: OpenChange) => void) {
		const { user } = await render(FfmPopover, {
			rootProps: { onOpenChange },
			before: true,
			after: true,
		});
		const trigger = screen.getByTestId("reference");
		await user.click(trigger);
		await waitFor(() => {
			expect(screen.getByTestId("child")).toHaveFocus();
		});
		return { user, trigger };
	}

	it("reports one close when Shift+Tab leaves the trigger", async () => {
		const onOpenChange = vi.fn();
		const { user, trigger } = await setup(onOpenChange);
		// From the popup's first element back to the trigger, then on to what comes before it.
		await user.tab({ shift: true });
		expect(trigger).toHaveFocus();
		onOpenChange.mockClear();

		await user.tab({ shift: true });
		await flushMicrotasks();

		expect(screen.getByTestId("before")).toHaveFocus();
		expect(closes(onOpenChange)).toEqual([[false, REASONS.focusOut]]);
	});

	it("reports nothing when the popover was closed and kept mounted", async () => {
		const onOpenChange = vi.fn((open: boolean, details: PopoverRootChangeEventDetails) => {
			if (!open) {
				details.preventUnmountOnClose();
			}
		});
		const { user, trigger } = await setup(onOpenChange);
		await user.keyboard("{Escape}");
		await flushMicrotasks();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		// Closed, and still in the document.
		expect(screen.queryByTestId("floating")).not.toBe(null);
		onOpenChange.mockClear();

		for (let round = 0; round < 2; round += 1) {
			await act(async () => trigger.focus());
			await act(async () => screen.getByTestId("after").focus());
			await flushMicrotasks();
		}

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("still closes an open popover when focus leaves its trigger", async () => {
		const onOpenChange = vi.fn();
		const { trigger } = await setup(onOpenChange);
		await act(async () => trigger.focus());
		onOpenChange.mockClear();

		await act(async () => screen.getByTestId("after").focus());
		await flushMicrotasks();

		expect(closes(onOpenChange)).toEqual([[false, REASONS.focusOut]]);
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});
});
