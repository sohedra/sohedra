// Svelte transitions work alongside the CSS model through a `render`
// snippet with a `|global` transition on the element that spreads `props`. The popover unmounts
// on its own schedule (after CSS animations, `onOpenChangeComplete(false)`), and Svelte's outro
// then plays on the unmounting element before it leaves the DOM.

import { describe, expect, it, vi } from "vitest";

import { createRenderer, fireEvent, screen, waitFor } from "../../shim/index.js";
import TransitionPopover from "./fixtures/popover-transition.svelte";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.each(["transition", "in-out", "svelte-element"] as const)(
	"Popover.Popup with a Svelte %s render snippet",
	(variant) => {
		const { render } = createRenderer();

		it("plays the outro after the popover unmounts, then removes the popup", async () => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			const onOpenChangeComplete = vi.fn();
			const onoutroend = vi.fn();
			const { user } = await render(TransitionPopover, {
				variant,
				onOpenChangeComplete,
				onoutroend,
			});
			const trigger = screen.getByRole("button", { name: "Open" });
			await user.click(trigger);
			const popup = await screen.findByTestId("popup");
			// The intro runs on the element itself (Svelte uses the Web Animations API).
			expect(popup.getAnimations().length).toBeGreaterThan(0);
			await waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true));
			await waitFor(() => expect(popup.getAnimations()).toHaveLength(0));

			await user.keyboard("{Escape}");
			// Unmounted on Sohedra's schedule: the outro starts only now.
			await waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
			expect(onOpenChangeComplete).toHaveBeenCalledTimes(2);
			expect(popup.isConnected).toBe(true);
			expect(popup.getAnimations().length).toBeGreaterThan(0);
			// Attributes freeze during the outro (Svelte 5 pauses effects in outroing blocks).
			expect(popup).toHaveAttribute("data-closed");
			// Focus returned to the trigger when the popover unmounted, before the outro ends.
			await waitFor(() => expect(trigger).toHaveFocus());
			expect(trigger).toHaveAttribute("aria-expanded", "false");

			await waitFor(() => expect(popup.isConnected).toBe(false));
			expect(onoutroend).toHaveBeenCalledTimes(1);
			expect(document.querySelector("[data-sohedra-portal]")).toBe(null);
		});

		it("keeps its position during the outro and ignores outside presses", async () => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			const onOpenChangeComplete = vi.fn();
			const { user } = await render(TransitionPopover, {
				variant,
				onOpenChangeComplete,
				duration: 200,
			});
			await user.click(screen.getByRole("button", { name: "Open" }));
			const positioner = await screen.findByTestId("positioner");
			await waitFor(() => expect(positioner.style.transform).toMatch(/translate/));
			const transform = positioner.style.transform;
			await user.keyboard("{Escape}");
			await waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
			expect(positioner.isConnected).toBe(true);
			expect(positioner.style.transform).toBe(transform);
			// (Closed before the intro finished: the opening never completed.)
			const calls = onOpenChangeComplete.mock.calls.length;
			fireEvent.click(screen.getByRole("button", { name: "Outside" }));
			expect(onOpenChangeComplete).toHaveBeenCalledTimes(calls);
			await waitFor(() => expect(positioner.isConnected).toBe(false));
		});

		it("reverses the outro when reopened during it", async () => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			const onOpenChangeComplete = vi.fn();
			const { user } = await render(TransitionPopover, {
				variant,
				onOpenChangeComplete,
				duration: 300,
			});
			const trigger = screen.getByRole("button", { name: "Open" });
			await user.click(trigger);
			const popup = await screen.findByTestId("popup");
			await waitFor(() => expect(popup.getAnimations()).toHaveLength(0));
			await user.keyboard("{Escape}");
			await waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
			await user.click(trigger);
			await wait(400);
			const reopened = screen.getByTestId("popup");
			expect(reopened).toHaveAttribute("data-open");
			expect(trigger).toHaveAttribute("aria-expanded", "true");
			// Still dismissable.
			await user.keyboard("{Escape}");
			await waitFor(() => expect(screen.queryByTestId("popup")).toBe(null));
		});
	},
);

describe("Popover.Popup with keepMounted and a Svelte transition", () => {
	const { render } = createRenderer();

	it("never plays the outro: a kept-mounted popup doesn't unmount (use the CSS model)", async () => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
		const onoutroend = vi.fn();
		const { user } = await render(TransitionPopover, { keepMounted: true, onoutroend });
		await user.click(screen.getByRole("button", { name: "Open" }));
		const popup = await screen.findByTestId("popup");
		await user.keyboard("{Escape}");
		await waitFor(() => expect(popup).toHaveAttribute("data-closed"));
		await wait(200);
		expect(popup.isConnected).toBe(true);
		expect(onoutroend).not.toHaveBeenCalled();
	});
});
