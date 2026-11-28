// Sohedra case: a Portal removed from the markup while its popover is open. A close afterwards
// has no popup to wait for, so it never completes: the Root waits on the popup element and does
// nothing without one.

import { describe, expect, it, vi } from "vitest";

import { createRenderer, screen, waitFor } from "../../shim/index.js";
import RemovedPortal from "./fixtures/popover-removed-portal.svelte";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("<Popover.Portal /> removed while open", () => {
	const { render } = createRenderer();

	it("doesn't complete a close without a popup", async () => {
		const onOpenChangeComplete = vi.fn();
		const { user } = await render(RemovedPortal, { onOpenChangeComplete });
		const trigger = screen.getByRole("button", { name: "Toggle" });

		await user.click(trigger);
		await waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true));
		await user.click(screen.getByRole("button", { name: "Remove" }));
		expect(screen.queryByTestId("popup")).toBe(null);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");

		await user.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		await wait(50);
		expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
	});
});
