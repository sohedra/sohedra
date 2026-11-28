// The state recorder in the render snippet is a component with an `$effect.pre`; the
// controlled case uses `open={true}` without `bind:` (nothing changes it in the test).

import { describe, expect, it } from "vitest";

import type { PopoverBackdropState } from "#lib/components/popover/popover-types.js";

import { describeConformance } from "../../conformance/conformance-part.js";
import { createRenderer, screen, waitFor } from "../../shim/index.js";
import { popoverBackdropConformance } from "./fixtures/popover-backdrop-conformance.js";
import PartBackdropHover from "./fixtures/popover-backdrop-hover.svelte";
import PartBackdropRecord from "./fixtures/popover-backdrop-record.svelte";

describe("<Popover.Backdrop />", () => {
	const { render } = createRenderer();

	describeConformance("Popover.Backdrop", () => popoverBackdropConformance);

	it.each([false, true])(
		"does not start an entry phase when initially open (controlled=%s)",
		async (controlled) => {
			const statuses = new Set<PopoverBackdropState["transitionStatus"]>();

			await render(PartBackdropRecord, {
				controlled,
				onState: (state: PopoverBackdropState) => statuses.add(state.transitionStatus),
			});

			expect(statuses).toEqual(new Set([undefined]));
		},
	);

	it("sets `pointer-events: none` style on backdrop if opened by hover", async () => {
		const { user } = await render(PartBackdropHover, { delay: 0 });

		await user.hover(screen.getByText("Open"));

		expect(screen.getByTestId("backdrop").style.pointerEvents).toBe("none");
	});

	it("does not set `pointer-events: none` style on backdrop if opened by click", async () => {
		const { user } = await render(PartBackdropHover);

		await user.click(screen.getByText("Open"));

		await waitFor(() => {
			expect(screen.getByTestId("backdrop").style.pointerEvents).not.toBe("none");
		});
	});
});
