// Sohedra: popover cases no other test covers. Keys and clicks come from `userEvent` from
// `vitest/browser`: real input, so the browser runs microtasks between focus events as it does
// for a user.

import { describe, expect, it, vi } from "vitest";
import { userEvent as browserUser } from "vitest/browser";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverRootChangeEventDetails } from "#lib/components/popover/popover-types.js";

import { createRenderer, screen, waitFor } from "../../shim/index.js";
import BasicPopover from "./fixtures/popover-basic.svelte";
import DetachedThreeTriggers from "./fixtures/popover-detached-three-triggers.svelte";

/** Two frames, so queued focus handling and frame callbacks have run. */
const settle = () =>
	new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});

describe("Popover", () => {
	const { render } = createRenderer();

	it("calls `onOpenChange` once when Tab moves focus out of the popup", async () => {
		const onOpenChange = vi.fn<(open: boolean, details: PopoverRootChangeEventDetails) => void>();
		await render(BasicPopover, { rootProps: { onOpenChange }, withClose: true });

		await browserUser.keyboard("{Tab}");
		expect(screen.getByTestId("trigger")).toHaveFocus();
		await browserUser.keyboard("{Enter}");
		await waitFor(() => {
			expect(screen.getByText("Close")).toHaveFocus();
		});
		onOpenChange.mockClear();

		await browserUser.keyboard("{Tab}");
		await waitFor(() => {
			expect(screen.queryByTestId("popup")).toBe(null);
		});
		await settle();

		// Only the trigger's focus guard closes it.
		expect(onOpenChange.mock.calls.map(([open, details]) => [open, details.reason])).toEqual([
			[false, "focus-out"],
		]);
		expect(onOpenChange.mock.calls[0][1].trigger).toHaveAttribute("data-sohedra-focus-guard");
	});

	// A press outside a non-modal popup makes its content untabbable until focus enters it again.
	it("keeps the popup's content untabbable when another detached trigger takes it over", async () => {
		const handle = Popover.createHandle();
		await render(DetachedThreeTriggers, { handle, withClose: true });

		await browserUser.click(screen.getByRole("button", { name: "Trigger 1" }));
		await screen.findByTestId("popup");
		await browserUser.click(screen.getByRole("button", { name: "Trigger 2" }));
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Trigger 2" })).toHaveAttribute(
				"aria-expanded",
				"true",
			);
		});
		await settle();

		const close = screen.getByRole("button", { name: "Close" });
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
});
