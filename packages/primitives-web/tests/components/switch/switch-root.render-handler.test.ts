// What happens to a part's own handler when a `render` snippet writes a handler for the same event
// after the spread. Svelte lets the later attribute win, so the snippet's handler replaces the
// merged one. The test records that; it does not decide whether `Part` should do anything about
// it.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import SwitchRootRenderOwnHandler from "./fixtures/switch-root-render-own-handler.svelte";

describe("Switch.Root render snippet with its own handler after the spread", () => {
	it("runs the snippet's handler and loses the part's own", async () => {
		const mine = vi.fn();
		await render(SwitchRootRenderOwnHandler, { mine });
		const element = page.getByRole("switch");

		await userEvent.click(element);

		expect(mine).toHaveBeenCalledTimes(1);
		// The part's click handler did not run: the switch did not toggle.
		await expect.element(element).toHaveAttribute("aria-checked", "false");
	});

	it("keeps the part's handlers for the other events", async () => {
		await render(SwitchRootRenderOwnHandler, { mine: vi.fn() });
		const element = page.getByRole("switch");

		// Space goes through the part's keyup handler, which clicks the element: the snippet's
		// `onclick` takes that click too, so the switch still does not toggle.
		(element.element() as HTMLElement).focus();
		await userEvent.keyboard(" ");

		await expect.element(element).toHaveAttribute("aria-checked", "false");
	});
});
