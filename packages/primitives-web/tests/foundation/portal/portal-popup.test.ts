// The popup Portal part through a Popover (the element marked `data-sohedra-portal`): a container
// that only exists after mount, and the portal id that `aria-owns` names. The Popover's portal
// tests and the Portal conformance runs cover the rest.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import FocusPopover from "../focus/fixtures/focus-popover.svelte";
import PortalNullContainer from "./fixtures/portal-null-container.svelte";

describe("PortalPopup", () => {
	it("allows containers to be initially null", async () => {
		const screen = await render(PortalNullContainer);

		await userEvent.click(screen.getByTestId("anchor"));
		const popup = screen.getByTestId("popup");
		await expect.element(popup).toBeInTheDocument();

		const subRoot = popup.element().closest("[data-sohedra-portal]");
		const root = screen.getByTestId("root").element();
		expect(root).toBe(subRoot?.parentElement);
	});

	it("uses the rendered portal ID for the aria-owns relationship", async () => {
		await render(FocusPopover, { open: true, portalProps: { id: "custom-portal" } });

		await expect
			.poll(() => document.querySelector("[aria-owns]"))
			.toHaveAttribute("aria-owns", "custom-portal");
	});
});
