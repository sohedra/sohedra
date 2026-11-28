// The tracked popup is a render snippet in fixtures/popover-transition-state.svelte; it records its
// state from a component with an `$effect.pre`, and its styles are the fixture's global CSS.

import { describe, expect, it, vi } from "vitest";

import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";

import { createRenderer, screen, waitFor } from "../../shim/index.js";
import PartTransitionStatePopover from "./fixtures/popover-transition-state.svelte";

type PopupState = Pick<PopoverPopupState, "open" | "transitionStatus">;

describe("Popover popup transition state", () => {
	const { render } = createRenderer();

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

		const { user } = await render(PartTransitionStatePopover, {
			onState,
			onOpenChangeComplete: completed,
		});
		const trigger = screen.getByRole("button", { name: "Toggle" });

		// The transition lasts longer than any phase of the test, so it cannot end before it is
		// observed on a busy runner. Each phase is finished explicitly instead of waited out.
		async function finishPhase(element: HTMLElement) {
			await waitFor(() => expect(element.getAnimations().length).toBeGreaterThan(0));
			expect(completed).not.toHaveBeenCalled();
			element.getAnimations().forEach((animation) => animation.finish());
		}

		async function openPopover() {
			states.length = 0;
			completed.mockClear();
			await user.click(trigger);
			const popup = await screen.findByRole("dialog");
			await finishPhase(popup);
			await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(true));
			expect(states.filter((state) => state.open)).toEqual([
				{ open: true, transitionStatus: "starting" },
				{ open: true, transitionStatus: undefined },
			]);
			return popup;
		}

		async function closePopover(popup: HTMLElement) {
			completed.mockClear();
			await user.keyboard("{Escape}");
			await finishPhase(popup);
			await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(false));
			// `keepMounted` retains the element, so the next opening reuses it.
			expect(popup.isConnected).toBe(true);
		}

		const popup = await openPopover();
		await closePopover(popup);
		expect(await openPopover()).toBe(popup);
	});
});
