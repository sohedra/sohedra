// The trees are the `popover-detached-*.svelte` fixtures. The stale-ref cases render the trigger through a
// `render` snippet and keep their store-registration and handoff assertions. The "does not
// re-render inactive triggers" cases keep their behaviour assertions without a render counter. A
// popup's per-render state (`instantsWhileEnding`) is recorded each time the state the `render`
// snippet receives changes. Controlled roots use the `open` + `onOpenChange` pattern; the
// late controlled close refuses the close with `cancel()` until the parent commits it.

import { PATIENT_CLICK_THRESHOLD } from "@sohedra/primitives-core/components/popover/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";

import { detachedTriggersConformanceTests } from "../../conformance/detached-triggers-conformance.js";
import { act, createRenderer, fireEvent, isJSDOM, screen, waitFor } from "../../shim/index.js";
import DetachedConsumerRef from "./fixtures/popover-detached-consumer-ref.svelte";
import DetachedDisappearingTrigger from "./fixtures/popover-detached-disappearing-trigger.svelte";
import DetachedFocusGuards from "./fixtures/popover-detached-focus-guards.svelte";
import DetachedFocusProgrammatic from "./fixtures/popover-detached-focus-programmatic.svelte";
import DetachedHoverHandoff from "./fixtures/popover-detached-hover-handoff.svelte";
import DetachedHoverInstant from "./fixtures/popover-detached-hover-instant.svelte";
import DetachedLateClose from "./fixtures/popover-detached-late-close.svelte";
import DetachedOpenOnMount from "./fixtures/popover-detached-open-on-mount.svelte";
import DetachedOutsideButton from "./fixtures/popover-detached-outside-button.svelte";
import DetachedPropClose from "./fixtures/popover-detached-prop-close.svelte";
import DetachedPropReopen from "./fixtures/popover-detached-prop-reopen.svelte";
import DetachedRemount from "./fixtures/popover-detached-remount.svelte";
import DetachedSwapNode from "./fixtures/popover-detached-swap-node.svelte";
import DetachedThreeTriggers from "./fixtures/popover-detached-three-triggers.svelte";

/** Flushes pending microtasks. */
async function flushMicrotasks() {
	await act(async () => {});
}

describe("<Popover.Root />", () => {
	beforeEach(() => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
	});

	const { render, clock } = createRenderer();

	it("opens by trigger from a descendant layout effect on initial mount", async () => {
		const handle = Popover.createHandle();
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		await render(DetachedOpenOnMount, { handle });

		const detachedWarned = consoleWarn.mock.calls.some(
			([message]) =>
				typeof message === "string" && message.includes("no root using this handle is mounted"),
		);
		consoleWarn.mockRestore();

		expect(detachedWarned).toBe(false);
		expect(handle.isOpen).toBe(true);
		expect(screen.getByRole("button", { name: "Trigger" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});

	it("hands off hover between detached triggers when the rendered component retains a stale ref", async () => {
		const handle = Popover.createHandle<number>();
		const fallbackStore = handle.store;

		const { user } = await render(DetachedHoverHandoff, { handle });

		expect(fallbackStore.triggers.size).toBe(0);
		expect(handle.store.triggers.size).toBe(2);

		await user.hover(screen.getByRole("button", { name: "Trigger 1" }));
		await waitFor(() => {
			expect(screen.getByTestId("popup")).toHaveTextContent("1");
		});

		await user.hover(screen.getByRole("button", { name: "Trigger 2" }));
		await waitFor(() => {
			expect(screen.getByTestId("popup")).toHaveTextContent("2");
		});
	});

	it("keeps registration on the attached store when a stale-ref component swaps its host node", async () => {
		const handle = Popover.createHandle<number>();
		const fallbackStore = handle.store;

		const { user } = await render(DetachedSwapNode, { handle });

		const initialTrigger = screen.getByRole("button", { name: "Trigger" });
		expect(fallbackStore.triggers.size).toBe(0);
		expect(handle.store.triggers.getById("trigger")).toBe(initialTrigger);

		// Replacing the host node re-attaches the trigger's ref after the migration.
		await user.click(screen.getByRole("button", { name: "Swap node" }));

		const swappedTrigger = screen.getByRole("button", { name: "Trigger" });
		// Guards the setup: without a real host swap the rest of the test proves nothing.
		expect(swappedTrigger).not.toBe(initialTrigger);
		expect(initialTrigger.isConnected).toBe(false);
		expect(fallbackStore.triggers.size).toBe(0);
		expect(handle.store.triggers.getById("trigger")).toBe(swappedTrigger);

		// `open()` searches attached stores first, so a registration left on the wrong store would
		// anchor the popup to the removed node.
		await act(async () => {
			handle.open("trigger");
		});

		await waitFor(() => {
			expect(screen.getByTestId("popup")).toBeVisible();
		});
		expect(handle.store.activeTriggerElement).toBe(swappedTrigger);
	});

	it("does not detach the consumer ref when the handle attaches to a root", async () => {
		const handle = Popover.createHandle();
		const refCalls: (Element | null)[] = [];

		await render(DetachedConsumerRef, {
			handle,
			onRef: (element: HTMLElement | null) => {
				refCalls.push(element);
			},
		});

		expect(handle.store.triggers.getById("trigger")).toBe(
			screen.getByRole("button", { name: "Trigger" }),
		);
		// Migrating from the fallback store to the root's store must not churn the bound ref, which
		// would hand the consumer a spurious `null` and back.
		expect(refCalls).toEqual([screen.getByRole("button", { name: "Trigger" })]);
	});

	detachedTriggersConformanceTests({
		render,
		createHandle: Popover.createHandle,
		Root: Popover.Root,
		Trigger: Popover.Trigger,
		Portal: Popover.Portal,
		Positioner: Popover.Positioner,
		Popup: Popover.Popup,
		Viewport: Popover.Viewport,
		Close: Popover.Close,
		openInteractions: ["click"],
		ariaExpanded: true,
		throwOnMissingTrigger: true,
	});

	// Render counting doesn't apply: these keep their behaviour assertions.
	describe("does not re-render inactive triggers", () => {
		async function renderPopover({
			rootProps,
			triggerProps,
			withClose,
		}: {
			rootProps?: Popover.Root.Props;
			triggerProps?: Popover.Trigger.Props;
			withClose?: boolean;
		} = {}) {
			const handle = Popover.createHandle();

			const { user } = await render(DetachedThreeTriggers, {
				handle,
				rootProps,
				triggerProps,
				withClose,
			});

			return {
				user,
				handle,
				trigger: screen.getByRole("button", { name: "Trigger 1" }),
				trigger2: screen.getByRole("button", { name: "Trigger 2" }),
			};
		}

		async function expectOpenedBy(trigger: HTMLElement) {
			expect(await screen.findByTestId("popup")).not.toBe(null);
			await waitFor(() => {
				expect(trigger).toHaveAttribute("aria-expanded", "true");
			});
		}

		async function expectClosed(trigger: HTMLElement) {
			await waitFor(() => {
				expect(screen.queryByTestId("popup")).toBe(null);
			});
			expect(trigger).toHaveAttribute("aria-expanded", "false");
		}

		it("when a click opens and closes the popup", async () => {
			const { user, trigger } = await renderPopover();

			async function openAndClose() {
				await user.click(trigger);
				await expectOpenedBy(trigger);
				await user.click(trigger);
				await expectClosed(trigger);
			}

			await openAndClose();
			await openAndClose();
		});

		it("when a touch press opens and closes the popup", async () => {
			const { user, trigger } = await renderPopover();

			async function openAndClose() {
				await user.pointer({ keys: "[TouchA]", target: trigger });
				await expectOpenedBy(trigger);
				await user.pointer({ keys: "[TouchA]", target: trigger });
				await expectClosed(trigger);
			}

			await openAndClose();
			await openAndClose();
		});

		it("when a modal popup closes from Popover.Close", async () => {
			const { user, trigger } = await renderPopover({
				rootProps: { modal: true },
				withClose: true,
			});

			async function openAndClose() {
				await user.click(trigger);
				await expectOpenedBy(trigger);
				await user.click(screen.getByRole("button", { name: "Close" }));
				await expectClosed(trigger);
			}

			await openAndClose();
			await openAndClose();
		});

		it("when the popup moves to another trigger", async () => {
			const { user, trigger, trigger2 } = await renderPopover();

			await user.click(trigger);
			await expectOpenedBy(trigger);
			await user.click(trigger2);
			await expectOpenedBy(trigger2);
			expect(trigger).toHaveAttribute("aria-expanded", "false");
			expect(trigger).not.toHaveAttribute("data-pressed");
			expect(trigger2).toHaveAttribute("data-pressed");
			expect(trigger.previousElementSibling).toBe(null);
			expect(trigger2.previousElementSibling).toHaveAttribute("data-sohedra-focus-guard");
			expect(trigger2.nextElementSibling).toHaveAttribute("data-sohedra-focus-guard");
			await user.click(trigger2);
			await expectClosed(trigger2);
		});

		describe("with openOnHover", () => {
			clock.withFakeTimers();

			it("when a hover opens the popup", async () => {
				const { handle, trigger } = await renderPopover({
					triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
				});

				async function openAndClose() {
					fireEvent.mouseEnter(trigger);
					fireEvent.mouseMove(trigger);
					await flushMicrotasks();
					expect(screen.queryByTestId("popup")).not.toBe(null);
					expect(trigger).toHaveAttribute("aria-expanded", "true");

					// Covers the patient-click window ending while open.
					clock.tick(PATIENT_CLICK_THRESHOLD);
					fireEvent.mouseLeave(trigger);
					await act(() => handle.close());
					await flushMicrotasks();
					expect(screen.queryByTestId("popup")).toBe(null);
					expect(trigger).toHaveAttribute("aria-expanded", "false");
				}

				await openAndClose();
				await openAndClose();
			});

			it("when a press takes over a hover-opened popup", async () => {
				const { handle, trigger } = await renderPopover({
					triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
				});

				fireEvent.mouseEnter(trigger);
				fireEvent.mouseMove(trigger);
				await flushMicrotasks();
				expect(screen.queryByTestId("popup")).not.toBe(null);

				// A press inside the patient-click window keeps it open and changes the open reason.
				fireEvent.click(trigger);
				await flushMicrotasks();
				expect(trigger).toHaveAttribute("data-pressed");

				fireEvent.mouseLeave(trigger);
				await act(() => handle.close());
				await flushMicrotasks();
				expect(screen.queryByTestId("popup")).toBe(null);
			});
		});
	});

	describe("after a prop-only reopen", () => {
		clock.withFakeTimers();

		it("keeps the popup open when the last hovered trigger is pressed", async () => {
			const handle = Popover.createHandle();

			const { component } = await render(DetachedPropReopen, { handle });
			const setOpen = (open: boolean) => component.setOpen(open);
			const trigger = screen.getByRole("button", { name: "Trigger 1" });

			fireEvent.mouseEnter(trigger);
			fireEvent.mouseMove(trigger);
			await flushMicrotasks();
			expect(screen.queryByTestId("popup")).not.toBe(null);
			// End the hover's patient-click window so only the close-time reset keeps the click sticky.
			clock.tick(PATIENT_CLICK_THRESHOLD);

			await act(async () => setOpen(false));
			await flushMicrotasks();
			expect(screen.queryByTestId("popup")).toBe(null);

			await act(async () => setOpen(true));
			await flushMicrotasks();
			expect(screen.queryByTestId("popup")).not.toBe(null);

			fireEvent.click(trigger);
			await flushMicrotasks();
			expect(screen.queryByTestId("popup")).not.toBe(null);
		});
	});

	it("dismisses a keyboard-reopened popup on a virtual outside click after a touch session", async () => {
		const handle = Popover.createHandle();
		const { user } = await render(DetachedOutsideButton, { handle });

		const trigger = screen.getByRole("button", { name: "Trigger" });
		await user.click(trigger);
		const popup = await screen.findByTestId("popup");

		fireEvent.pointerDown(popup, { pointerType: "touch", button: 0 });
		fireEvent.pointerUp(popup, { pointerType: "touch", button: 0 });
		fireEvent.click(popup);
		await user.keyboard("[Escape]");
		await waitFor(() => {
			expect(screen.queryByTestId("popup")).toBe(null);
		});

		await act(async () => trigger.focus());
		await user.keyboard("[Enter]");
		await screen.findByTestId("popup");

		// Virtual clicks have no pointerdown to replace the previous session's touch type.
		fireEvent.click(screen.getByRole("button", { name: "Outside" }), { detail: 0 });
		await waitFor(() => {
			expect(screen.queryByTestId("popup")).toBe(null);
		});
	});

	describe.skipIf(isJSDOM)("multiple triggers within Root", () => {
		it("returns focus to the active trigger when opening programmatically from body focus", async () => {
			const { user } = await render(DetachedFocusProgrammatic);

			const trigger1 = screen.getByRole("button", { name: "Trigger 1" });
			const trigger2 = screen.getByRole("button", { name: "Trigger 2" });

			await user.click(trigger1);
			await user.click(screen.getByRole("button", { name: "Close" }));
			await waitFor(() => {
				expect(trigger1).toHaveFocus();
			});

			trigger1.blur();
			expect(document.body).toHaveFocus();

			await user.click(screen.getByRole("button", { name: "Open Trigger 2 without focus" }));
			await waitFor(() => {
				expect(screen.getByTestId("content")).toBeVisible();
			});

			await user.click(screen.getByRole("button", { name: "Close" }));
			await waitFor(() => {
				expect(trigger2).toHaveFocus();
			});
		});

		it("returns focus to the previous element when the trigger unmounts while open", async () => {
			const { user } = await render(DetachedDisappearingTrigger);

			const fallback = screen.getByRole("button", { name: "Focus fallback" });
			await user.click(fallback);
			expect(fallback).toHaveFocus();

			await user.click(screen.getByRole("button", { name: "Disappearing trigger" }));
			await waitFor(() => {
				expect(screen.getByTestId("content")).toBeVisible();
			});

			await user.click(screen.getByRole("button", { name: "Close" }));
			await waitFor(() => {
				expect(screen.queryByTestId("content")).toBe(null);
			});
			expect(fallback).toHaveFocus();
		});
	});

	describe.skipIf(isJSDOM)("multiple detached triggers", () => {
		/**
		 * Renders two detached hover triggers with a real position transition on the
		 * positioner and a real exit transition on the popup, then hands the popover
		 * off from trigger 1 to trigger 2 so `instantType` is `trigger-change`.
		 *
		 * `instantsWhileEnding` records the `instant` state of every closing render,
		 * which is the only way to observe a stale value that a later render clears
		 * before the DOM can be asserted on.
		 */
		async function renderHoverDetachedTriggers({
			withClose = false,
			settleTriggerChange = true,
			switchDuration = 120,
			exitDuration = 250,
		}: {
			withClose?: boolean;
			/**
			 * Set to `false` to return while the positioner is still animating to the
			 * new trigger, so the delayed `trigger-change` restoration is still pending.
			 */
			settleTriggerChange?: boolean;
			/** How long the positioner takes to move to the new trigger. */
			switchDuration?: number;
			/** How long the popup takes to fade out. */
			exitDuration?: number;
		} = {}) {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;

			const testPopover = Popover.createHandle<number>();
			const instantsWhileEnding: (string | undefined)[] = [];

			const utils = await render(DetachedHoverInstant, {
				handle: testPopover,
				withClose,
				switchDuration,
				exitDuration,
				onRender: (state: PopoverPopupState) => {
					if (state.transitionStatus === "ending") {
						instantsWhileEnding.push(state.instant);
					}
				},
			});

			const trigger1 = screen.getByRole("button", { name: "Trigger 1" });
			const trigger2 = screen.getByRole("button", { name: "Trigger 2" });

			await utils.user.hover(trigger1);
			await waitFor(() => {
				expect(screen.getByTestId("content").textContent).toBe("1");
			});

			await utils.user.hover(trigger2);
			await waitFor(() => {
				expect(screen.getByTestId("content").textContent).toBe("2");
			});

			if (settleTriggerChange) {
				await waitFor(() => {
					expect(screen.getByTestId("popup")).toHaveAttribute("data-instant", "trigger-change");
				});
			}

			// The handoff itself legitimately renders `trigger-change` while closing
			// the previous trigger's popup. Only the close that follows matters.
			instantsWhileEnding.length = 0;

			return {
				...utils,
				trigger1,
				trigger2,
				instantsWhileEnding,
				popup: screen.getByTestId("popup"),
			};
		}

		it("does not apply the trigger-change instant to a hover close after switching triggers", async () => {
			const { user, trigger2, popup, instantsWhileEnding } = await renderHoverDetachedTriggers();

			await user.unhover(trigger2);
			await waitFor(() => {
				expect(popup).toHaveAttribute("data-ending-style");
			});

			expect(instantsWhileEnding).not.toContain("trigger-change");
		});

		it("does not apply the trigger-change instant to a non-hover close after switching triggers", async () => {
			const { popup, instantsWhileEnding } = await renderHoverDetachedTriggers({
				withClose: true,
			});

			fireEvent.click(screen.getByRole("button", { name: "Close" }));
			await waitFor(() => {
				expect(popup).toHaveAttribute("data-ending-style");
			});

			expect(instantsWhileEnding).not.toContain("trigger-change");
		});

		it("does not apply the trigger-change instant after switching back to the original trigger", async () => {
			const { user, trigger1, instantsWhileEnding } = await renderHoverDetachedTriggers();

			await user.hover(trigger1);
			await waitFor(() => {
				expect(screen.getByTestId("content").textContent).toBe("1");
			});
			await waitFor(() => {
				expect(screen.getByTestId("popup")).toHaveAttribute("data-instant", "trigger-change");
			});
			instantsWhileEnding.length = 0;

			await user.unhover(trigger1);
			await waitFor(() => {
				expect(screen.getByTestId("popup")).toHaveAttribute("data-ending-style");
			});

			expect(instantsWhileEnding).not.toContain("trigger-change");
		});

		it("does not restore the trigger-change instant after a reopen on the same trigger", async () => {
			// Leaving and returning mid-exit keeps the positioner mounted and the
			// trigger unchanged, so nothing re-runs the effect to cancel the pending
			// switch callback. A slow switch keeps it pending across the reopen.
			const { user, trigger2 } = await renderHoverDetachedTriggers({
				settleTriggerChange: false,
				switchDuration: 500,
				exitDuration: 400,
			});

			await user.unhover(trigger2);
			await waitFor(() => {
				expect(screen.getByTestId("popup")).toHaveAttribute("data-ending-style");
			});

			await user.hover(trigger2);
			await waitFor(
				() => {
					expect(screen.getByTestId("popup")).not.toHaveAttribute("data-ending-style");
				},
				{ timeout: 3000 },
			);

			// Wait for the slow switch transition itself to end, however late a loaded run starts it:
			// that is when the stale switch callback would fire.
			const reopenedPopup = screen.getByTestId("popup");
			const positioner = screen.getByTestId("positioner");
			await act(async () => {
				await Promise.all(
					positioner.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
				);
				await new Promise((resolve) => {
					setTimeout(resolve, 150);
				});
			});

			expect(reopenedPopup.getAttribute("data-instant")).toBe(null);
		});

		it("does not apply the trigger-change instant to a prop-driven close after a switch", async () => {
			// A controlled consumer can switch triggers and close entirely through
			// props, so neither transition passes through `setOpen`.
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;

			const endingInstants: (string | undefined)[] = [];

			const { user, component: controls } = await render(DetachedPropClose, {
				onRender: (state: PopoverPopupState) => {
					if (state.transitionStatus === "ending") {
						endingInstants.push(state.instant);
					}
				},
			});

			await user.click(screen.getByRole("button", { name: "Trigger 1" }));
			await waitFor(() => {
				expect(screen.queryByTestId("popup")).not.toBe(null);
			});
			await act(async () => {
				await new Promise((resolve) => {
					setTimeout(resolve, 100);
				});
			});

			await act(async () => {
				controls.setTriggerId("t2");
			});
			await waitFor(() => {
				expect(screen.getByTestId("popup")).toHaveAttribute("data-instant", "trigger-change");
			});

			endingInstants.length = 0;
			await act(async () => {
				controls.setOpen(false);
			});
			await waitFor(
				() => {
					expect(endingInstants.length).toBeGreaterThan(0);
				},
				{ timeout: 2000 },
			);

			expect(endingInstants).not.toContain("trigger-change");

			// Reopening on the same trigger, again purely through props, must not
			// inherit the `trigger-change` the earlier switch had stored.
			await waitFor(() => {
				expect(screen.queryByTestId("popup")).toBe(null);
			});

			await act(async () => {
				controls.setOpen(true);
			});
			await waitFor(() => {
				expect(screen.queryByTestId("popup")).not.toBe(null);
			});

			expect(screen.getByTestId("popup")).not.toHaveAttribute("data-instant");
		});

		it("does not restore the trigger-change instant when a controlled close commits late", async () => {
			// A controlled consumer can accept the close but commit `open={false}`
			// later. That commit goes straight through the prop without passing back
			// through `setOpen`, so a `trigger-change` restored in the meantime would
			// never be cleared and would collapse the exit transition.
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;

			const instantsWhileEnding: (string | undefined)[] = [];
			// Renders between the close request and its late commit. The restoration
			// has to land in this window, or the test isn't exercising the race.
			const instantsWhileClosePending: (string | undefined)[] = [];
			const openedTriggerIds: (string | undefined)[] = [];

			const { user } = await render(DetachedLateClose, {
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

			const trigger1 = screen.getByRole("button", { name: "Trigger 1" });
			const trigger2 = screen.getByRole("button", { name: "Trigger 2" });

			await user.hover(trigger1);
			await waitFor(() => {
				expect(screen.queryByTestId("popup")).not.toBe(null);
			});

			// Let the first open settle so moving to trigger 2 is a real switch.
			await act(async () => {
				await new Promise((resolve) => {
					setTimeout(resolve, 100);
				});
			});

			await user.hover(trigger2);
			// Request the close while the switch is still animating.
			await user.unhover(trigger2);

			await waitFor(
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
			const { user, trigger2, popup } = await renderHoverDetachedTriggers({
				settleTriggerChange: false,
			});

			const positioner = screen.getByTestId("positioner");
			await waitFor(() => {
				expect(positioner.getAnimations().length).toBeGreaterThan(0);
			});
			const switchAnimations = positioner.getAnimations();

			await user.unhover(trigger2);
			await waitFor(() => {
				expect(popup).toHaveAttribute("data-ending-style");
			});

			await act(async () => {
				await Promise.all(switchAnimations.map((animation) => animation.finished));
			});

			// Still mid-exit: the stale callback must not have marked it instant and
			// collapsed the transition.
			expect(screen.getByTestId("popup")).toBe(popup);
			expect(popup).toHaveAttribute("data-ending-style");
			expect(popup).not.toHaveAttribute("data-instant");
		});

		it("renders focus guards around the active detached trigger and reports it on close", async () => {
			const testPopover = Popover.createHandle();
			const onOpenChange = vi.fn();
			const { user } = await render(DetachedFocusGuards, { handle: testPopover, onOpenChange });

			const trigger2 = screen.getByRole("button", { name: "Trigger 2" });

			await user.click(trigger2);
			await waitFor(() => {
				expect(screen.getByText("Content")).toBeVisible();
			});
			expect(trigger2.previousElementSibling).toHaveAttribute("data-sohedra-focus-guard");
			expect(trigger2.nextElementSibling).toHaveAttribute("data-sohedra-focus-guard");

			await user.click(screen.getByRole("button", { name: "Close" }));
			await waitFor(() => {
				expect(screen.queryByText("Content")).toBe(null);
			});
			expect(trigger2.previousElementSibling).not.toHaveAttribute("data-sohedra-focus-guard");
			expect(trigger2.nextElementSibling).not.toHaveAttribute("data-sohedra-focus-guard");
			// Closing with Popover.Close reports the active trigger.
			expect(onOpenChange).toHaveBeenCalledTimes(2);
			expect(onOpenChange.mock.calls[1][0]).toBe(false);
			expect(onOpenChange.mock.calls[1][1].trigger).toBe(trigger2);
		});

		it("keeps positioning correct when conditional triggers unmount and the tree remounts", async () => {
			const testPopover = Popover.createHandle();

			const { user } = await render(DetachedRemount, { handle: testPopover });

			const trigger0 = screen.getByRole("button", { name: "Trigger 0" });
			await waitFor(() => {
				expect(
					Math.abs(
						screen.getByTestId("positioner").getBoundingClientRect().left -
							trigger0.getBoundingClientRect().left,
					),
				).toBeLessThanOrEqual(1);
			});

			await user.click(screen.getByRole("button", { name: "Toggle" }));
			const trigger0After = screen.getByRole("button", { name: "Trigger 0" });
			await waitFor(() => {
				expect(
					Math.abs(
						screen.getByTestId("positioner").getBoundingClientRect().left -
							trigger0After.getBoundingClientRect().left,
					),
				).toBeLessThanOrEqual(1);
			});
		});
	});
});
