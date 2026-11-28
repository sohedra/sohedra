// The suite every popup runs (Popover, Dialog, Tooltip, Menu, Select…): axe closed and open, the
// controlled and default open state, `onOpenChange` and its cancel, the trigger's ARIA, and
// `onOpenChangeComplete` with and without animations.
import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { isInaccessible } from "@testing-library/dom";
import type { Component } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { expectNoAxeViolations, type AxeOptions } from "../kit/kit-axe.js";
import { nextFrame } from "../kit/kit-frames.js";
import { injectStyle } from "../kit/kit-style.js";

/**
 * Describes a popup to the suite: the fixture it renders the popup with, how the parts' props map
 * onto that fixture, and what the popup's trigger and element are.
 */
export type PopupConformanceSetup = {
	/**
	 * The popup from all its parts. `props` maps the parts' props onto it; the trigger gets
	 * `data-testid="trigger"` and the popup element `data-testid="popup"` through them.
	 */
	// oxlint-disable-next-line typescript/no-explicit-any -- each popup's fixture has its own props
	demo: Component<any>;
	/** Maps the props of the popup's parts onto the fixture's props. Called again to rerender. */
	props: (parts: PopupConformanceParts) => Record<string, unknown>;
	/** How the trigger opens the popup. */
	triggerAction: "click" | "hover";
	/** The popup element's `role`. */
	popupRole?: string;
	/** The trigger's `aria-haspopup`; the popup's role when omitted. */
	ariaHasPopup?: string;
	/** `"only-after-open"` when the popup stays mounted (inaccessible) after it first closes. */
	alwaysMounted?: "only-after-open";
	/** Whether the popup is a combobox's listbox. */
	combobox?: boolean;
	/**
	 * Whether the element receiving the `popup` props plays the enter and exit animations.
	 * @default true
	 */
	exitAnimation?: boolean;
	/**
	 * The `reason` `onOpenChange` receives when the trigger opens the popup.
	 * @default "trigger-press" for click triggers, "trigger-hover" for hover triggers
	 */
	openReason?: string;
	/**
	 * For the axe checks: props that complete the popup the way a page would (a name for a dialog
	 * the fixture renders without a Title), and rules the fixture can't satisfy.
	 */
	axe?: AxeOptions & { popupProps?: PopupConformancePopupProps };
};

export interface OpenChangeEventDetails {
	reason: string;
	cancel: () => void;
}

export interface PopupConformanceRootProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean, eventDetails: OpenChangeEventDetails) => void;
	onOpenChangeComplete?: (open: boolean) => void;
}

export interface PopupConformanceTriggerProps {
	"data-testid"?: string;
	delay?: number;
}

export interface PopupConformancePopupProps {
	class?: string;
	id?: string;
	"data-testid"?: string;
	"aria-label"?: string;
}

export interface PopupConformancePortalProps {
	keepMounted?: boolean;
}

export interface PopupConformanceParts {
	root?: PopupConformanceRootProps;
	popup?: PopupConformancePopupProps;
	trigger?: PopupConformanceTriggerProps;
	portal?: PopupConformancePortalProps;
}

const trigger = () => page.getByTestId("trigger");
const popup = () => page.getByTestId("popup");

let animations = 0;

/** Runs the popup suite for the popup `name` (`"Popover"`). */
export function describePopupConformance(name: string, setup: () => PopupConformanceSetup): void {
	const config = () => {
		const value = setup();
		return {
			...value,
			ariaHasPopup: value.ariaHasPopup ?? value.popupRole,
			exitAnimation: value.exitAnimation ?? true,
			openReason:
				value.openReason ??
				(value.triggerAction === "click" ? REASONS.triggerPress : REASONS.triggerHover),
		};
	};

	const propsFor = (parts: PopupConformanceParts) =>
		setup().props({
			...parts,
			trigger: {
				"data-testid": "trigger",
				// Hover-opened popups open right away, so the cases don't depend on timers.
				...(setup().triggerAction === "hover" ? { delay: 0 } : {}),
				...parts.trigger,
			},
			popup: { "data-testid": "popup", ...parts.popup },
		});

	const renderPopup = (parts: PopupConformanceParts) => render(setup().demo, propsFor(parts));

	async function openWithTrigger() {
		if (setup().triggerAction === "click") {
			await userEvent.click(trigger());
		} else {
			await userEvent.hover(trigger());
		}
	}

	// A popup that stays mounted after opening is hidden instead of removed when it closes.
	async function expectPopupClosed() {
		if (setup().alwaysMounted) {
			await expect.poll(() => isInaccessible(popup().element())).toBe(true);
		} else {
			await expect.element(popup()).not.toBeInTheDocument();
		}
	}

	const isAnimating = () =>
		popup()
			.element()
			.getAnimations()
			.some((animation) => animation.playState === "running");

	describe(`${name} popup conformance`, () => {
		afterEach(() => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
		});

		describe("axe", () => {
			it("has no axe violations while closed", async () => {
				await renderPopup({ popup: config().axe?.popupProps });
				await expect.element(trigger()).toBeInTheDocument();
				await expectNoAxeViolations(document.body, config().axe);
			});

			it("has no axe violations once opened by its trigger", async () => {
				await renderPopup({ popup: config().axe?.popupProps });
				await openWithTrigger();
				await expect.element(popup()).toBeVisible();
				// Initial focus moves into the popup a frame after it opens.
				await nextFrame();
				await expectNoAxeViolations(document.body, config().axe);
			});
		});

		describe("controlled mode", () => {
			it("opens the popup with the `open` prop", async () => {
				const screen = await renderPopup({ root: { open: false } });
				expect(popup().query()).toBe(null);

				await screen.rerender(propsFor({ root: { open: true } }));
				await expect.poll(() => popup().query()).not.toBe(null);
			});
		});

		describe("prop: defaultOpen", () => {
			it("opens initially and remains uncontrolled", async () => {
				await renderPopup({ root: { defaultOpen: true } });
				await expect.element(popup()).toBeVisible();

				await userEvent.keyboard("{Escape}");
				await expectPopupClosed();
			});

			it("is ignored when `open={false}` is passed", async () => {
				await renderPopup({ root: { defaultOpen: true, open: false } });
				expect(popup().query()).toBe(null);
			});

			it("is ignored when `open={true}` is passed, so Escape cannot close", async () => {
				// The parent refuses the close (a controlled `open` without `onOpenChange`).
				await renderPopup({
					root: {
						defaultOpen: true,
						open: true,
						onOpenChange: (nextOpen, eventDetails) => {
							if (!nextOpen) {
								eventDetails.cancel();
							}
						},
					},
				});
				await expect.element(popup()).toBeVisible();

				await userEvent.keyboard("{Escape}");
				await nextFrame();
				await expect.element(popup()).toBeVisible();
			});
		});

		describe("prop: onOpenChange", () => {
			it("is called with the new open state and the change details", async () => {
				const handleOpenChange = vi.fn();
				await renderPopup({ root: { onOpenChange: handleOpenChange } });
				expect(handleOpenChange).not.toHaveBeenCalled();

				await openWithTrigger();
				await vi.waitFor(() => {
					expect(handleOpenChange).toHaveBeenCalledTimes(1);
				});
				await expect.element(popup()).toBeVisible();
				expect(handleOpenChange).toHaveBeenCalledTimes(1);
				expect(handleOpenChange).toHaveBeenNthCalledWith(
					1,
					true,
					expect.objectContaining({ reason: config().openReason, trigger: trigger().element() }),
				);

				await userEvent.keyboard("{Escape}");
				await expectPopupClosed();
				expect(handleOpenChange).toHaveBeenCalledTimes(2);
				expect(handleOpenChange).toHaveBeenNthCalledWith(
					2,
					false,
					expect.objectContaining({ reason: REASONS.escapeKey }),
				);
			});

			it("keeps the popup closed when the open change is canceled", async () => {
				const handleOpenChange = vi.fn(
					(nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
						if (nextOpen) {
							eventDetails.cancel();
						}
					},
				);
				await renderPopup({ root: { onOpenChange: handleOpenChange } });

				await openWithTrigger();
				await vi.waitFor(() => {
					expect(handleOpenChange).toHaveBeenCalledTimes(1);
				});
				await nextFrame();

				// The open request was made, so a missing popup proves `cancel()` prevented it.
				expect(handleOpenChange).toHaveBeenCalledTimes(1);
				expect(handleOpenChange).toHaveBeenNthCalledWith(
					1,
					true,
					expect.objectContaining({ reason: config().openReason }),
				);
				await expectPopupClosed();
				await expect.element(trigger()).not.toHaveAttribute("data-popup-open");
			});
		});

		describe("ARIA attributes", () => {
			it.runIf(setup().popupRole)(`has the ${setup().popupRole} role on the popup`, async () => {
				await renderPopup({ root: { open: true } });
				await expect.element(popup()).toHaveAttribute("role", config().popupRole);
			});

			it.runIf(setup().triggerAction === "click")(
				"has the `aria-controls` attribute on the trigger",
				async () => {
					await renderPopup({ root: { open: true } });
					await expect.element(trigger()).toHaveAttribute("aria-controls", popup().element().id);
				},
			);

			it.runIf(setup().triggerAction === "click")(
				"opens on trigger click and sets `aria-expanded` on the trigger",
				async () => {
					await renderPopup({});
					expect(popup().query()).toBe(null);
					await expect.element(trigger()).toHaveAttribute("aria-expanded", "false");
					await userEvent.click(trigger());
					// A combobox popup is the listbox itself; other popups mark the open state.
					const [openAttribute, openValue] = config().combobox
						? ["role", "listbox"]
						: ["data-open", ""];
					await expect.element(popup()).toHaveAttribute(openAttribute, openValue);
					await expect.element(trigger()).toHaveAttribute("aria-expanded", "true");
				},
			);

			it.runIf(setup().triggerAction === "click" && config().ariaHasPopup)(
				"has the `aria-haspopup` attribute on the trigger",
				async () => {
					const screen = await renderPopup({ root: { open: false } });
					await expect.element(trigger()).toHaveAttribute("aria-haspopup", config().ariaHasPopup);

					await screen.rerender(propsFor({ root: { open: true } }));
					await expect.element(trigger()).toHaveAttribute("aria-haspopup", config().ariaHasPopup);
				},
			);

			it.runIf(setup().triggerAction === "click")("allows a custom `id` prop", async () => {
				await renderPopup({ root: { open: true }, popup: { id: "TestId" } });
				await expect.element(popup()).toHaveAttribute("id", "TestId");
				await expect.element(trigger()).toHaveAttribute("aria-controls", "TestId");
			});
		});

		describe("prop: onOpenChangeComplete", () => {
			it("is not called on mount when closed", async () => {
				const onOpenChangeComplete = vi.fn();
				await renderPopup({ root: { onOpenChangeComplete } });

				expect(onOpenChangeComplete).not.toHaveBeenCalled();
			});

			it("is called on open when there is no enter animation", async () => {
				const onOpenChangeComplete = vi.fn();
				const screen = await renderPopup({ root: { open: false, onOpenChangeComplete } });

				await screen.rerender(propsFor({ root: { open: true, onOpenChangeComplete } }));
				await vi.waitFor(() => {
					expect(onOpenChangeComplete).toHaveBeenCalled();
				});
				await nextFrame();
				expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
			});

			it("is called on close when there is no exit animation", async () => {
				const onOpenChangeComplete = vi.fn();
				const screen = await renderPopup({ root: { open: true, onOpenChangeComplete } });

				await screen.rerender(propsFor({ root: { open: false, onOpenChangeComplete } }));
				await expectPopupClosed();
				await vi.waitFor(() => {
					expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
				});
				expect(onOpenChangeComplete.mock.calls).toEqual([[true], [false]]);
			});

			/**
			 * The popup with an enter and an exit animation (different keyframes: swapping the
			 * selector while keeping the same animation name doesn't restart it).
			 */
			async function renderAnimatedPopup(
				open: boolean,
				onOpenChangeComplete: (open: boolean) => void,
			) {
				animations += 1;
				const animation = `popup-conformance-${animations}`;
				injectStyle(`
					@keyframes ${animation}-enter { from { opacity: 0; } }
					@keyframes ${animation}-exit { to { opacity: 0; } }
					.${animation}[data-open] { animation: ${animation}-enter 200ms; }
					.${animation}[data-ending-style] { animation: ${animation}-exit 200ms; }
				`);
				const toProps = (next: boolean) =>
					propsFor({ root: { open: next, onOpenChangeComplete }, popup: { class: animation } });
				const screen = await render(setup().demo, toProps(open));
				return { setOpen: (next: boolean) => screen.rerender(toProps(next)) };
			}

			it.runIf(config().exitAnimation)(
				"is called on open once the enter animation finishes",
				async () => {
					globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
					const onOpenChangeComplete = vi.fn();
					const { setOpen } = await renderAnimatedPopup(false, onOpenChangeComplete);

					await setOpen(true);
					await vi.waitFor(() => {
						expect(isAnimating()).toBe(true);
					});
					// Read right after the check above: the animation is still running.
					expect(onOpenChangeComplete).not.toHaveBeenCalled();

					await vi.waitFor(() => {
						expect(onOpenChangeComplete).toHaveBeenCalled();
					});
					expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
				},
			);

			it.runIf(config().exitAnimation)(
				"is called on close once the exit animation finishes",
				async () => {
					globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
					const onOpenChangeComplete = vi.fn();
					const { setOpen } = await renderAnimatedPopup(true, onOpenChangeComplete);
					await vi.waitFor(() => {
						expect(onOpenChangeComplete).toHaveBeenCalled();
					});
					onOpenChangeComplete.mockClear();

					await setOpen(false);
					await expect.element(popup()).toHaveAttribute("data-ending-style");
					await vi.waitFor(() => {
						expect(isAnimating()).toBe(true);
					});
					expect(onOpenChangeComplete).not.toHaveBeenCalled();

					await expectPopupClosed();
					expect(onOpenChangeComplete.mock.calls).toEqual([[false]]);
				},
			);
		});

		describe("animations", () => {
			beforeEach(() => {
				globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			});

			it("removes the popup when there is no exit animation defined", async () => {
				const screen = await renderPopup({ root: { open: true } });

				await expect.poll(() => popup().query()).not.toBe(null);

				await screen.rerender(propsFor({ root: { open: false } }));
				await expectPopupClosed();
			});

			it.runIf(config().exitAnimation)(
				"hides the kept-mounted popup once the exit animation finishes",
				async () => {
					animations += 1;
					const animation = `popup-conformance-${animations}`;
					injectStyle(`
						@keyframes ${animation} { to { opacity: 0; } }
						.${animation}[data-open] { opacity: 1; }
						.${animation}[data-ending-style] { animation: ${animation} 150ms; }
					`);
					const toProps = (open: boolean) =>
						propsFor({
							root: { open },
							// A popup that stays mounted after opening doesn't accept `keepMounted`.
							portal: setup().alwaysMounted ? {} : { keepMounted: true },
							popup: { class: animation },
						});

					const screen = await render(setup().demo, toProps(true));
					await screen.rerender(toProps(false));

					// The popup stays visible while the exit animation runs...
					await expect.element(popup()).toHaveAttribute("data-ending-style");
					expect(popup().element().getAnimations()).not.toHaveLength(0);
					expect(isInaccessible(popup().element())).toBe(false);

					// ...and is hidden once it finishes.
					await vi.waitFor(() => {
						expect(isInaccessible(popup().element())).toBe(true);
					});
				},
			);
		});
	});
}
