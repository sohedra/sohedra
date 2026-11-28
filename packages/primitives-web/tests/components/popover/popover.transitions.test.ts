// Popover.Popup's transitions: the transition status a kept-mounted popup moves through, and
// Svelte transitions on a `render` snippet, which play on Popover's schedule (the outro after the
// popover unmounts, once its CSS animations end).
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";

import { nextFrame } from "../../kit/kit-frames.js";
import PopoverTransitionState from "./fixtures/popover-transition-state.svelte";
import PopoverTransition from "./fixtures/popover-transition.svelte";

type PopupState = Pick<PopoverPopupState, "open" | "transitionStatus">;

describe("Popover.Popup transition status", () => {
	it("starts each opening once when the popup is kept mounted", async () => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
		const states: PopupState[] = [];
		function onState(state: PopupState) {
			const previous = states[states.length - 1];
			if (previous?.open !== state.open || previous?.transitionStatus !== state.transitionStatus) {
				states.push(state);
			}
		}
		const completed = vi.fn();

		await render(PopoverTransitionState, { onState, onOpenChangeComplete: completed });
		const trigger = page.getByRole("button", { name: "Toggle" });

		// The transition lasts longer than any phase of the test, so it cannot end before it is
		// observed on a busy runner. Each phase is finished explicitly instead of waited out.
		async function finishPhase(element: HTMLElement) {
			await vi.waitFor(() => expect(element.getAnimations().length).toBeGreaterThan(0));
			expect(completed).not.toHaveBeenCalled();
			element.getAnimations().forEach((animation) => animation.finish());
		}

		async function openPopover() {
			states.length = 0;
			completed.mockClear();
			await userEvent.click(trigger);
			await expect.element(page.getByRole("dialog")).toBeInTheDocument();
			const popup = page.getByRole("dialog").element() as HTMLElement;
			await finishPhase(popup);
			await vi.waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(true));
			expect(states.filter((state) => state.open)).toEqual([
				{ open: true, transitionStatus: "starting" },
				{ open: true, transitionStatus: undefined },
			]);
			return popup;
		}

		async function closePopover(popup: HTMLElement) {
			completed.mockClear();
			await userEvent.keyboard("{Escape}");
			await finishPhase(popup);
			await vi.waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(false));
			// `keepMounted` retains the element, so the next opening reuses it.
			expect(popup.isConnected).toBe(true);
		}

		const popup = await openPopover();
		await closePopover(popup);
		expect(await openPopover()).toBe(popup);
	});
});

describe.each(["transition", "in-out", "svelte-element"] as const)(
	"Popover.Popup with a Svelte %s render snippet",
	(variant) => {
		it("plays the outro after the popover unmounts, then removes the popup", async () => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			const onOpenChangeComplete = vi.fn();
			const onoutroend = vi.fn();
			await render(PopoverTransition, { variant, onOpenChangeComplete, onoutroend });
			const trigger = page.getByRole("button", { name: "Open" });
			await userEvent.click(trigger);
			await expect.element(page.getByTestId("popup")).toBeInTheDocument();
			const popup = page.getByTestId("popup").element();
			// The intro runs on the element itself (Svelte uses the Web Animations API).
			expect(popup.getAnimations().length).toBeGreaterThan(0);
			await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true));
			await vi.waitFor(() => expect(popup.getAnimations()).toHaveLength(0));

			await userEvent.keyboard("{Escape}");
			// Unmounted on Sohedra's schedule: the outro starts only now.
			await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
			expect(onOpenChangeComplete).toHaveBeenCalledTimes(2);
			expect(popup.isConnected).toBe(true);
			expect(popup.getAnimations().length).toBeGreaterThan(0);
			// Attributes freeze during the outro (Svelte 5 pauses effects in outroing blocks).
			expect(popup).toHaveAttribute("data-closed");
			// Focus returned to the trigger when the popover unmounted, before the outro ends.
			await expect.element(trigger).toHaveFocus();
			await expect.element(trigger).toHaveAttribute("aria-expanded", "false");

			await vi.waitFor(() => expect(popup.isConnected).toBe(false));
			expect(onoutroend).toHaveBeenCalledTimes(1);
			expect(document.querySelector("[data-sohedra-portal]")).toBe(null);
		});

		it("keeps its position during the outro and ignores outside presses", async () => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			const onOpenChangeComplete = vi.fn();
			await render(PopoverTransition, { variant, onOpenChangeComplete, duration: 200 });
			await userEvent.click(page.getByRole("button", { name: "Open" }));
			await expect.element(page.getByTestId("positioner")).toBeInTheDocument();
			const positioner = page.getByTestId("positioner").element() as HTMLElement;
			await vi.waitFor(() => expect(positioner.style.transform).toMatch(/translate/));
			const transform = positioner.style.transform;
			await userEvent.keyboard("{Escape}");
			await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
			expect(positioner.isConnected).toBe(true);
			expect(positioner.style.transform).toBe(transform);
			// (Closed before the intro finished: the opening never completed.)
			const calls = onOpenChangeComplete.mock.calls.length;
			await userEvent.click(page.getByRole("button", { name: "Outside" }));
			expect(onOpenChangeComplete).toHaveBeenCalledTimes(calls);
			await vi.waitFor(() => expect(positioner.isConnected).toBe(false));
		});

		it("reverses the outro when reopened during it", async () => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			const onOpenChangeComplete = vi.fn();
			await render(PopoverTransition, { variant, onOpenChangeComplete, duration: 300 });
			const trigger = page.getByRole("button", { name: "Open" });
			await userEvent.click(trigger);
			await expect.element(page.getByTestId("popup")).toBeInTheDocument();
			const popup = page.getByTestId("popup").element();
			await vi.waitFor(() => expect(popup.getAnimations()).toHaveLength(0));
			await userEvent.keyboard("{Escape}");
			await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
			await userEvent.click(trigger);
			// The reversed outro has ended and the popup is the one shown.
			await vi.waitFor(() => {
				expect(page.getByTestId("popup").elements()).toHaveLength(1);
				expect(page.getByTestId("popup").element().getAnimations()).toHaveLength(0);
			});
			const reopened = page.getByTestId("popup").element();
			expect(reopened).toHaveAttribute("data-open");
			await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
			// Still dismissable.
			await userEvent.keyboard("{Escape}");
			await vi.waitFor(() => expect(page.getByTestId("popup").query()).toBe(null));
		});
	},
);

describe("Popover.Popup with keepMounted and a Svelte transition", () => {
	it("never plays the outro: a kept-mounted popup doesn't unmount (use the CSS model)", async () => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
		const onoutroend = vi.fn();
		await render(PopoverTransition, { keepMounted: true, onoutroend });
		await userEvent.click(page.getByRole("button", { name: "Open" }));
		await expect.element(page.getByTestId("popup")).toBeInTheDocument();
		const popup = page.getByTestId("popup").element();
		await userEvent.keyboard("{Escape}");
		await expect.element(popup).toHaveAttribute("data-closed");
		// An outro would start, and with keepMounted never unmount the popup, in the frames after the
		// close.
		await nextFrame();
		await nextFrame();
		expect(popup.isConnected).toBe(true);
		expect(onoutroend).not.toHaveBeenCalled();
	});
});
