// Popover.Backdrop: no entry phase for a popover that starts open, and pointer events by how the
// popover opened.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import type { PopoverBackdropState } from "#lib/components/popover/popover-types.js";

import PopoverBackdropStates from "./fixtures/popover-backdrop-states.svelte";
import PopoverDemo from "./fixtures/popover-demo.svelte";

const backdropStyle = () => page.getByTestId("backdrop").element().style;

describe("Popover.Backdrop", () => {
	it.each([false, true])(
		"does not start an entry phase when initially open (controlled=%s)",
		async (controlled) => {
			const statuses = new Set<PopoverBackdropState["transitionStatus"]>();

			await render(PopoverBackdropStates, {
				controlled,
				onState: (state: PopoverBackdropState) => statuses.add(state.transitionStatus),
			});

			expect(statuses).toEqual(new Set([undefined]));
		},
	);

	it("sets `pointer-events: none` style on backdrop if opened by hover", async () => {
		await render(PopoverDemo, {
			triggers: ["Open"],
			triggerProps: { openOnHover: true, delay: 0 },
			backdropProps: {},
		});

		await userEvent.hover(page.getByRole("button", { name: "Open" }));

		await expect.poll(() => backdropStyle().pointerEvents).toBe("none");
	});

	it("does not set `pointer-events: none` style on backdrop if opened by click", async () => {
		await render(PopoverDemo, {
			triggers: ["Open"],
			triggerProps: { openOnHover: true },
			backdropProps: {},
		});

		await userEvent.click(page.getByRole("button", { name: "Open" }));

		await expect.element(page.getByTestId("backdrop")).toBeInTheDocument();
		await expect.poll(() => backdropStyle().pointerEvents).not.toBe("none");
	});
});
