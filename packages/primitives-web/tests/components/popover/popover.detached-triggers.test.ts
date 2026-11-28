// Popover's triggers outside the Root, on a handle: opening from a mount effect, registration when
// a trigger's element changes, the active trigger's press state and focus guards, and the
// `instant` state when the popup moves between triggers.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands, type Locator, page, userEvent } from "vitest/browser";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";

import { dispatch } from "../../kit/kit-events.js";
import { nextFrame, nextTask } from "../../kit/kit-frames.js";
import PopoverDemo from "./fixtures/popover-demo.svelte";
import PopoverInstantHover from "./fixtures/popover-instant-hover.svelte";
import PopoverInstantLateClose from "./fixtures/popover-instant-late-close.svelte";
import PopoverInstantPropClose from "./fixtures/popover-instant-prop-close.svelte";
import PopoverOpenOnMount from "./fixtures/popover-open-on-mount.svelte";
import PopoverRemountedTree from "./fixtures/popover-remounted-tree.svelte";
import PopoverRenderTriggers from "./fixtures/popover-render-triggers.svelte";
import PopoverSwappedTrigger from "./fixtures/popover-swapped-trigger.svelte";
import PopoverTriggerRef from "./fixtures/popover-trigger-ref.svelte";

const popup = () => page.getByTestId("popup");

/** The animations still running in the positioner and the popup. */
const runningAnimations = () =>
	[page.getByTestId("positioner"), popup()].flatMap(
		(locator) => locator.query()?.getAnimations() ?? [],
	);

describe("Popover.Root with detached triggers", () => {
	it("opens by trigger from a descendant layout effect on initial mount", async () => {
		const handle = Popover.createHandle();
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		await render(PopoverOpenOnMount, { handle });

		const detachedWarned = consoleWarn.mock.calls.some(
			([message]) =>
				typeof message === "string" && message.includes("no root using this handle is mounted"),
		);
		consoleWarn.mockRestore();

		expect(detachedWarned).toBe(false);
		expect(handle.isOpen).toBe(true);
		await expect
			.element(page.getByRole("button", { name: "Trigger" }))
			.toHaveAttribute("aria-expanded", "true");
	});

	it("hands off hover between detached triggers when the rendered component retains a stale ref", async () => {
		const handle = Popover.createHandle<number>();
		const fallbackStore = handle.store;

		await render(PopoverRenderTriggers, { handle });

		expect(fallbackStore.triggers.size).toBe(0);
		expect(handle.store.triggers.size).toBe(2);

		await userEvent.hover(page.getByRole("button", { name: "Trigger 1" }));
		await expect.element(popup()).toHaveTextContent("1");

		await userEvent.hover(page.getByRole("button", { name: "Trigger 2" }));
		await expect.element(popup()).toHaveTextContent("2");
	});

	it("keeps registration on the attached store when a stale-ref component swaps its host node", async () => {
		const handle = Popover.createHandle<number>();
		const fallbackStore = handle.store;

		await render(PopoverSwappedTrigger, { handle });

		const initialTrigger = page.getByRole("button", { name: "Trigger" }).element();
		expect(fallbackStore.triggers.size).toBe(0);
		expect(handle.store.triggers.getById("trigger")).toBe(initialTrigger);

		// Replacing the host node re-attaches the trigger's ref after the migration.
		await userEvent.click(page.getByRole("button", { name: "Swap node" }));

		const swappedTrigger = page.getByRole("button", { name: "Trigger" }).element();
		// Guards the setup: without a real host swap the rest of the test proves nothing.
		expect(swappedTrigger).not.toBe(initialTrigger);
		expect(initialTrigger.isConnected).toBe(false);
		expect(fallbackStore.triggers.size).toBe(0);
		expect(handle.store.triggers.getById("trigger")).toBe(swappedTrigger);

		// `open()` searches attached stores first, so a registration left on the wrong store would
		// anchor the popup to the removed node.
		handle.open("trigger");

		await expect.element(popup()).toBeVisible();
		expect(handle.store.activeTriggerElement).toBe(swappedTrigger);
	});

	it("does not detach the consumer ref when the handle attaches to a root", async () => {
		const handle = Popover.createHandle();
		const refCalls: (Element | null)[] = [];

		await render(PopoverTriggerRef, {
			handle,
			onRef: (element: HTMLElement | null) => {
				refCalls.push(element);
			},
		});

		expect(handle.store.triggers.getById("trigger")).toBe(
			page.getByRole("button", { name: "Trigger" }).element(),
		);
		// Migrating from the fallback store to the root's store must not churn the bound ref, which
		// would hand the consumer a spurious `null` and back.
		expect(refCalls).toEqual([page.getByRole("button", { name: "Trigger" }).element()]);
	});

	describe("with three triggers", () => {
		async function renderPopover(props: Record<string, unknown> = {}) {
			await render(PopoverDemo, {
				variant: "detached",
				triggers: ["Trigger 1", "Trigger 2", "Trigger 3"],
				...props,
			});
			return {
				trigger: page.getByRole("button", { name: "Trigger 1" }),
				trigger2: page.getByRole("button", { name: "Trigger 2" }),
			};
		}

		async function expectOpenedBy(trigger: Locator) {
			await expect.element(page.getByRole("dialog")).toBeInTheDocument();
			await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
		}

		async function expectClosed(trigger: Locator) {
			await expect.poll(() => page.getByRole("dialog").query()).toBe(null);
			await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
		}

		it("opens and closes on a click, again and again", async () => {
			const { trigger } = await renderPopover();

			async function openAndClose() {
				await userEvent.click(trigger);
				await expectOpenedBy(trigger);
				await userEvent.click(trigger);
				await expectClosed(trigger);
			}

			await openAndClose();
			await openAndClose();
		});

		it("opens and closes on a touch press, again and again", async () => {
			const { trigger } = await renderPopover();

			// No browser here emulates a touch pointer: the tap is dispatched with its pointer type.
			function tap() {
				const element = trigger.element();
				dispatch(element, "pointerdown", { pointerType: "touch", isPrimary: true });
				dispatch(element, "pointerup", { pointerType: "touch", isPrimary: true });
				dispatch(element, "click", { detail: 1 });
			}

			async function openAndClose() {
				tap();
				await expectOpenedBy(trigger);
				tap();
				await expectClosed(trigger);
			}

			await openAndClose();
			await openAndClose();
		});

		it("opens and closes a modal popup from Popover.Close, again and again", async () => {
			const { trigger } = await renderPopover({ rootProps: { modal: true }, close: "Close" });

			async function openAndClose() {
				await userEvent.click(trigger);
				await expectOpenedBy(trigger);
				await userEvent.click(page.getByRole("button", { name: "Close" }));
				await expectClosed(trigger);
			}

			await openAndClose();
			await openAndClose();
		});

		it("moves the press state and the focus guards when the popup moves to another trigger", async () => {
			const { trigger, trigger2 } = await renderPopover();

			await userEvent.click(trigger);
			await expectOpenedBy(trigger);
			await userEvent.click(trigger2);
			await expectOpenedBy(trigger2);
			await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
			await expect.element(trigger).not.toHaveAttribute("data-pressed");
			await expect.element(trigger2).toHaveAttribute("data-pressed");
			expect(trigger.element().previousElementSibling).toBe(null);
			expect(trigger2.element().previousElementSibling).toHaveAttribute("data-sohedra-focus-guard");
			expect(trigger2.element().nextElementSibling).toHaveAttribute("data-sohedra-focus-guard");
			await userEvent.click(trigger2);
			await expectClosed(trigger2);
		});

		it("renders focus guards around the active detached trigger and reports it on close", async () => {
			const onOpenChange = vi.fn();
			await renderPopover({
				triggers: ["Trigger 1", "Trigger 2"],
				afterTriggers: "After",
				close: "Close",
				rootProps: { onOpenChange },
			});

			const trigger2 = page.getByRole("button", { name: "Trigger 2" }).element();

			await userEvent.click(trigger2);
			await expect.element(page.getByRole("dialog")).toBeVisible();
			expect(trigger2.previousElementSibling).toHaveAttribute("data-sohedra-focus-guard");
			expect(trigger2.nextElementSibling).toHaveAttribute("data-sohedra-focus-guard");

			await userEvent.click(page.getByRole("button", { name: "Close" }));
			await expect.poll(() => page.getByRole("dialog").query()).toBe(null);
			expect(trigger2.previousElementSibling).not.toHaveAttribute("data-sohedra-focus-guard");
			expect(trigger2.nextElementSibling).not.toHaveAttribute("data-sohedra-focus-guard");
			// Closing with Popover.Close reports the active trigger.
			expect(onOpenChange).toHaveBeenCalledTimes(2);
			expect(onOpenChange.mock.calls[1][0]).toBe(false);
			expect(onOpenChange.mock.calls[1][1].trigger).toBe(trigger2);
		});
	});

	it("keeps positioning correct when conditional triggers unmount and the tree remounts", async () => {
		await render(PopoverRemountedTree, { handle: Popover.createHandle() });

		const trigger0 = page.getByRole("button", { name: "Trigger 0" }).element();
		await vi.waitFor(() => {
			expect(
				Math.abs(
					page.getByTestId("positioner").element().getBoundingClientRect().left -
						trigger0.getBoundingClientRect().left,
				),
			).toBeLessThanOrEqual(1);
		});

		await userEvent.click(page.getByRole("button", { name: "Toggle" }));
		const trigger0After = page.getByRole("button", { name: "Trigger 0" }).element();
		await vi.waitFor(() => {
			expect(
				Math.abs(
					page.getByTestId("positioner").element().getBoundingClientRect().left -
						trigger0After.getBoundingClientRect().left,
				),
			).toBeLessThanOrEqual(1);
		});
	});

	describe("the trigger-change instant", () => {
		/** Waits for the popup to show the `trigger-change` instant. */
		async function triggerChangeShown() {
			await expect.element(popup()).toHaveAttribute("data-instant", "trigger-change");
		}

		/** The real pointer leaves for the page's top-left corner, away from every popup. */
		const away = () => commands.parkPointer();

		/**
		 * Renders two detached hover triggers with a real position transition on the positioner and a
		 * real exit transition on the popup, then hands the popover off from trigger 1 to trigger 2
		 * so `instantType` is `trigger-change`.
		 *
		 * `instantsWhileEnding` records the `instant` state of every closing render, which is the
		 * only way to observe a stale value that a later render clears before the DOM can be
		 * asserted on.
		 */
		async function renderHoverDetachedTriggers({
			withClose = false,
			settleTriggerChange = true,
			switchDuration = 120,
			exitDuration = 250,
		}: {
			withClose?: boolean;
			/**
			 * `false` returns while the positioner is still animating to the new trigger, so the
			 * delayed `trigger-change` restoration is still pending.
			 */
			settleTriggerChange?: boolean;
			/** How long the positioner takes to move to the new trigger. */
			switchDuration?: number;
			/** How long the popup takes to fade out. */
			exitDuration?: number;
		} = {}) {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;

			const instantsWhileEnding: (string | undefined)[] = [];

			await render(PopoverInstantHover, {
				handle: Popover.createHandle<number>(),
				withClose,
				switchDuration,
				exitDuration,
				onRender: (state: PopoverPopupState) => {
					if (state.transitionStatus === "ending") {
						instantsWhileEnding.push(state.instant);
					}
				},
			});

			const trigger1 = page.getByRole("button", { name: "Trigger 1" });
			const trigger2 = page.getByRole("button", { name: "Trigger 2" });

			await userEvent.hover(trigger1);
			await expect.poll(() => page.getByTestId("content").query()?.textContent).toBe("1");

			await userEvent.hover(trigger2);
			await expect.poll(() => page.getByTestId("content").query()?.textContent).toBe("2");

			if (settleTriggerChange) {
				await triggerChangeShown();
			}

			// The handoff itself legitimately renders `trigger-change` while closing the previous
			// trigger's popup. Only the close that follows matters.
			instantsWhileEnding.length = 0;

			return { trigger1, trigger2, instantsWhileEnding, popup: popup().element() };
		}

		it("does not apply the trigger-change instant to a hover close after switching triggers", async () => {
			const { popup: element, instantsWhileEnding } = await renderHoverDetachedTriggers();

			await away();
			await expect.element(element).toHaveAttribute("data-ending-style");

			expect(instantsWhileEnding).not.toContain("trigger-change");
		});

		it("does not apply the trigger-change instant to a non-hover close after switching triggers", async () => {
			const { popup: element, instantsWhileEnding } = await renderHoverDetachedTriggers({
				withClose: true,
			});

			await userEvent.click(page.getByRole("button", { name: "Close" }));
			await expect.element(element).toHaveAttribute("data-ending-style");

			expect(instantsWhileEnding).not.toContain("trigger-change");
		});

		it("does not apply the trigger-change instant after switching back to the original trigger", async () => {
			const { trigger1, instantsWhileEnding } = await renderHoverDetachedTriggers();

			await userEvent.hover(trigger1);
			await expect.poll(() => page.getByTestId("content").query()?.textContent).toBe("1");
			await expect.element(popup()).toHaveAttribute("data-instant", "trigger-change");
			instantsWhileEnding.length = 0;

			await away();
			await expect.element(popup()).toHaveAttribute("data-ending-style");

			expect(instantsWhileEnding).not.toContain("trigger-change");
		});

		it("does not restore the trigger-change instant after a reopen on the same trigger", async () => {
			// Leaving and returning mid-exit keeps the positioner mounted and the trigger unchanged,
			// so nothing re-runs the effect to cancel the pending switch callback. A slow switch keeps
			// it pending across the reopen.
			const { trigger2 } = await renderHoverDetachedTriggers({
				settleTriggerChange: false,
				switchDuration: 500,
				exitDuration: 400,
			});

			await away();
			await expect.element(popup()).toHaveAttribute("data-ending-style");

			await userEvent.hover(trigger2);
			await expect.element(popup(), { timeout: 3000 }).not.toHaveAttribute("data-ending-style");

			// Wait for the slow switch transition itself to end, however late a loaded run starts it:
			// that is when the stale switch callback would fire, in the frame and task after it.
			const reopenedPopup = popup().element();
			const positioner = page.getByTestId("positioner").element();
			await Promise.all(
				positioner.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
			);
			await nextFrame();
			await nextTask();

			expect(reopenedPopup.getAttribute("data-instant")).toBe(null);
		});

		it("does not apply the trigger-change instant to a prop-driven close after a switch", async () => {
			// A controlled consumer can switch triggers and close entirely through props, so neither
			// transition passes through `setOpen`.
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;

			const endingInstants: (string | undefined)[] = [];

			const screen = await render(PopoverInstantPropClose, {
				onRender: (state: PopoverPopupState) => {
					if (state.transitionStatus === "ending") {
						endingInstants.push(state.instant);
					}
				},
			});
			const controls = screen.component;

			await userEvent.click(page.getByRole("button", { name: "Trigger 1" }));
			await expect.poll(() => popup().query()).not.toBe(null);
			// The opening settles, so the switch below is a switch between two placed positions.
			await expect.poll(() => runningAnimations()).toHaveLength(0);

			controls.setTriggerId("t2");
			await expect.element(popup()).toHaveAttribute("data-instant", "trigger-change");

			endingInstants.length = 0;
			controls.setOpen(false);
			await vi.waitFor(
				() => {
					expect(endingInstants.length).toBeGreaterThan(0);
				},
				{ timeout: 2000 },
			);

			expect(endingInstants).not.toContain("trigger-change");

			// Reopening on the same trigger, again purely through props, must not inherit the
			// `trigger-change` the earlier switch had stored.
			await expect.poll(() => popup().query()).toBe(null);

			controls.setOpen(true);
			await expect.poll(() => popup().query()).not.toBe(null);

			await expect.element(popup()).not.toHaveAttribute("data-instant");
		});

		it("does not restore the trigger-change instant when a controlled close commits late", async () => {
			// A controlled consumer can accept the close but commit `open={false}` later. That commit
			// goes straight through the prop without passing back through `setOpen`, so a
			// `trigger-change` restored in the meantime would never be cleared and would collapse
			// the exit transition.
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;

			const instantsWhileEnding: (string | undefined)[] = [];
			// Renders between the close request and its late commit. The restoration has to land in
			// this window, or the test isn't exercising the race.
			const instantsWhileClosePending: (string | undefined)[] = [];
			const openedTriggerIds: (string | undefined)[] = [];

			await render(PopoverInstantLateClose, {
				switchDuration: 200,
				commitDelay: 400,
				onOpenTrigger: (id: string | undefined) => openedTriggerIds.push(id),
				onRender: (state: PopoverPopupState, closeRequested: boolean) => {
					if (state.transitionStatus === "ending") {
						instantsWhileEnding.push(state.instant);
					} else if (closeRequested) {
						instantsWhileClosePending.push(state.instant);
					}
				},
			});

			await userEvent.hover(page.getByRole("button", { name: "Trigger 1" }));
			await expect.poll(() => popup().query()).not.toBe(null);

			// The first open settles, so moving to trigger 2 is a real switch.
			await expect.poll(() => runningAnimations()).toHaveLength(0);

			await userEvent.hover(page.getByRole("button", { name: "Trigger 2" }));
			// Request the close while the switch is still animating.
			await away();

			await vi.waitFor(
				() => {
					expect(instantsWhileEnding.length).toBeGreaterThan(0);
				},
				{ timeout: 2000 },
			);

			expect(openedTriggerIds).toEqual(["trigger-1", "trigger-2"]);
			expect(instantsWhileClosePending).toContain("trigger-change");
			expect(instantsWhileEnding).not.toContain("trigger-change");
		});

		it("does not restore the trigger-change instant after a hover close has started", async () => {
			const { popup: element } = await renderHoverDetachedTriggers({ settleTriggerChange: false });

			const positioner = page.getByTestId("positioner").element();
			await vi.waitFor(() => {
				expect(positioner.getAnimations().length).toBeGreaterThan(0);
			});
			const switchAnimations = positioner.getAnimations();

			await away();
			await expect.element(element).toHaveAttribute("data-ending-style");

			await Promise.all(switchAnimations.map((animation) => animation.finished));

			// Still mid-exit: the stale callback must not have marked it instant and collapsed the
			// transition.
			expect(popup().element()).toBe(element);
			expect(element).toHaveAttribute("data-ending-style");
			expect(element).not.toHaveAttribute("data-instant");
		});
	});
});
