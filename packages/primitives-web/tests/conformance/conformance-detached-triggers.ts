// The suite every popup with several triggers runs: which trigger is active, its payload, the
// controlled `triggerId`, and, for triggers outside the root on a handle, the handle's methods,
// root ownership across remounts and reparented triggers.
import type { Component } from "svelte";
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import ConformanceDetachedOverlap from "./fixtures/conformance-detached-overlap.svelte";
import ConformanceDetachedTriggersControlled from "./fixtures/conformance-detached-triggers-controlled.svelte";
import ConformanceDetachedTriggers from "./fixtures/conformance-detached-triggers.svelte";

type OpenInteraction = "click" | "hover" | "focus";

// Parts of different components have unrelated prop types; the suite only passes props that every
// tested component accepts.
// oxlint-disable-next-line typescript/no-explicit-any -- see above
type AnyComponent = Component<any>;

export interface DetachedTriggersTestHandle {
	open(triggerId: string): void;
	close(): void;
	readonly isOpen: boolean;
}

/**
 * Describes a popup with several triggers to the suite: its parts, which the suite's fixtures
 * render with numbered triggers (`data-testid="trigger-<n>"`, payload `<n>`), either inside the
 * Root or outside it on a handle.
 */
export type DetachedTriggersConformanceSetup = {
	/** Creates a new handle for the popup, e.g. `Popover.createHandle`. */
	createHandle: () => DetachedTriggersTestHandle;
	Root: AnyComponent;
	Trigger: AnyComponent;
	Portal: AnyComponent;
	/** Omitted for popups that are not anchored to their trigger. */
	Positioner?: AnyComponent;
	Popup: AnyComponent;
	/** Enables the inline scale check after switching triggers. */
	Viewport?: AnyComponent;
	/**
	 * When given, click-opened popups are closed with it, and the programmatic case checks that
	 * focus returns to the element that opened the popup.
	 */
	Close?: AnyComponent;
	/** Props applied to every trigger, e.g. `{ href: '#', delay: 0 }`. */
	triggerProps?: Record<string, unknown>;
	/** Interactions that open the popup from a trigger. The first one is the primary one. */
	openInteractions: readonly [OpenInteraction, ...OpenInteraction[]];
	/** Whether triggers expose `aria-expanded` and `aria-controls`. */
	ariaExpanded: boolean;
	/**
	 * Whether `handle.open()` throws for an unregistered trigger id (anchored popups) instead of
	 * opening unassociated with a warning (Dialog).
	 */
	throwOnMissingTrigger: boolean;
};

interface FixtureProps {
	mode: "contained" | "detached";
	handle?: DetachedTriggersTestHandle | undefined;
	triggerCount?: number;
	rootProps?: Record<string, unknown>;
	rootMounted?: boolean;
	/** Renders the detached triggers after the Root. */
	rootFirst?: boolean;
	/** The number of wrapper elements around the triggers. */
	nesting?: number;
	positionerProps?: Record<string, unknown>;
	withViewport?: boolean;
}

const getTrigger = (number: number) => page.getByTestId(`trigger-${number}`);
const popup = () => page.getByTestId("popup");
const content = () => page.getByTestId("content");
const rootPayload = () => page.getByTestId("root-payload");

function countWarnings(consoleWarn: { mock: { calls: unknown[][] } }, text: string) {
	return consoleWarn.mock.calls.filter(
		([message]) => typeof message === "string" && message.includes(text),
	).length;
}

/** Runs the detached-triggers suite for the popup `name` (`"Popover"`). */
export function describeDetachedTriggersConformance(
	name: string,
	setup: () => DetachedTriggersConformanceSetup,
): void {
	const parts = () => {
		const { Root, Trigger, Portal, Positioner, Popup, Viewport, Close, triggerProps } = setup();
		return { Root, Trigger, Portal, Positioner, Popup, Viewport, Close, triggerProps };
	};
	const primaryInteraction = () => setup().openInteractions[0];
	// Switching the active trigger must keep the popup mounted. Hover-opened popups close as the
	// pointer leaves for the next trigger, so they switch with focus instead.
	const switchInteraction = (): OpenInteraction =>
		setup().openInteractions.includes("focus") ? "focus" : primaryInteraction();

	const renderFixture = (props: FixtureProps) =>
		render(ConformanceDetachedTriggers, { ...parts(), ...props });

	async function openWith(interaction: OpenInteraction, number: number) {
		if (interaction === "click") {
			await userEvent.click(getTrigger(number));
		} else if (interaction === "hover") {
			await userEvent.hover(getTrigger(number));
		} else {
			// Focus without a click or a key: a press would also toggle the popup.
			getTrigger(number).element().focus();
			flushSync();
		}
	}

	async function closeWith(interaction: OpenInteraction, number: number) {
		if (interaction === "click") {
			if (setup().Close) {
				await userEvent.click(page.getByText("Close popup"));
			} else {
				await userEvent.keyboard("{Escape}");
			}
		} else if (interaction === "hover") {
			await userEvent.unhover(getTrigger(number));
		} else {
			// The focus counterpart of `openWith`.
			getTrigger(number).element().blur();
			flushSync();
		}
	}

	async function switchTrigger(interaction: OpenInteraction, to: number) {
		// A real pointer leaves the previous trigger as it moves onto the next.
		await openWith(interaction, to);
	}

	async function waitForPopupOpen() {
		await expect.element(popup()).toBeVisible();
	}

	async function waitForPopupClosed() {
		await expect.element(popup()).not.toBeInTheDocument();
	}

	async function waitForContent(text: string) {
		await expect.poll(() => content().query()?.textContent).toBe(text);
	}

	/**
	 * Asserts that only the trigger numbered `activeNumber` is marked as the popup's active trigger
	 * (or that none is, when `activeNumber` is `null`).
	 */
	async function expectActiveTrigger(activeNumber: number | null, triggerCount = 2) {
		const popupId = activeNumber === null ? null : popup().element().id;

		for (let number = 1; number <= triggerCount; number += 1) {
			const trigger = getTrigger(number);
			const active = number === activeNumber;

			if (active) {
				await expect.element(trigger).toHaveAttribute("data-popup-open");
			} else {
				await expect.element(trigger).not.toHaveAttribute("data-popup-open");
			}

			if (setup().ariaExpanded) {
				await expect.element(trigger).toHaveAttribute("aria-expanded", String(active));
				if (active) {
					expect(popupId).not.toBe("");
					await expect.element(trigger).toHaveAttribute("aria-controls", popupId);
				} else if (popupId !== null) {
					await expect.element(trigger).not.toHaveAttribute("aria-controls");
				}
			}
		}
	}

	async function expectPositionerAlignedWith(number: number) {
		if (!setup().Positioner) {
			return;
		}
		const trigger = getTrigger(number).element();
		await expect
			.poll(() =>
				Math.abs(
					page.getByTestId("positioner").element().getBoundingClientRect().left -
						trigger.getBoundingClientRect().left,
				),
			)
			.toBeLessThanOrEqual(1);
	}

	describe(`${name} detached triggers conformance`, () => {
		describe.each([{ mode: "contained" as const }, { mode: "detached" as const }])(
			"$mode triggers",
			({ mode }) => {
				// In `contained` mode the handle is never passed to the parts.
				const getHandle = () => (mode === "detached" ? setup().createHandle() : undefined);

				describe("multiple triggers", () => {
					it.each(setup().openInteractions.map((interaction) => ({ interaction })))(
						"opens with any trigger on $interaction and marks only that trigger as active",
						async ({ interaction }) => {
							await renderFixture({ mode, handle: getHandle(), triggerCount: 3 });

							expect(popup().query()).toBe(null);
							await expectActiveTrigger(null, 3);

							for (const number of [1, 2, 3]) {
								await openWith(interaction, number);
								await waitForPopupOpen();
								await expectActiveTrigger(number, 3);

								await closeWith(interaction, number);
								await waitForPopupClosed();
								await expectActiveTrigger(null, 3);
							}
						},
					);

					it("sets the payload of the active trigger and renders content based on it", async () => {
						await renderFixture({ mode, handle: getHandle() });

						await openWith(primaryInteraction(), 1);
						await waitForContent("1");
						expect(rootPayload().element().textContent).toBe("1");

						await switchTrigger(primaryInteraction(), 2);
						await waitForContent("2");
						expect(rootPayload().element().textContent).toBe("2");
						await expectActiveTrigger(2);
					});

					it("reuses the popup DOM nodes when switching triggers", async () => {
						await renderFixture({ mode, handle: getHandle() });

						await openWith(switchInteraction(), 1);
						await waitForContent("1");
						const popupElement = popup().element();
						const positionerElement = page.getByTestId("positioner").query();

						await switchTrigger(switchInteraction(), 2);
						await waitForContent("2");
						expect(popup().element()).toBe(popupElement);
						expect(page.getByTestId("positioner").query()).toBe(positionerElement);
					});

					it("marks the trigger matching a controlled `triggerId` as active", async () => {
						await renderFixture({
							mode,
							handle: getHandle(),
							rootProps: { open: true, triggerId: "trigger-2" },
						});

						await waitForPopupOpen();
						expect(content().element().textContent).toBe("2");
						await expectActiveTrigger(2);
					});

					it("opens initially with the payload of a non-first `defaultTriggerId`", async () => {
						await renderFixture({
							mode,
							handle: getHandle(),
							triggerCount: 3,
							rootProps: { defaultOpen: true, defaultTriggerId: "trigger-2" },
						});

						await waitForContent("2");
						await expectActiveTrigger(2, 3);
					});

					it("allows controlling the open state and active trigger programmatically", async () => {
						await render(ConformanceDetachedTriggersControlled, {
							...parts(),
							mode,
							handle: getHandle(),
						});

						// Found up front: a modal popup hides the rest of the page from the accessibility
						// tree.
						const openTrigger1 = page.getByRole("button", { name: "Open Trigger 1" }).element();
						const openTrigger2 = page.getByRole("button", { name: "Open Trigger 2" }).element();
						const closeExternally = page
							.getByRole("button", { name: "Close externally" })
							.element();

						await userEvent.click(openTrigger1);
						await waitForContent("1");
						await expectActiveTrigger(1);
						await expectPositionerAlignedWith(1);

						// A keyboard press, so the button holds focus as the popup opens: WebKit doesn't focus a
						// pressed button.
						(openTrigger2 as HTMLElement).focus();
						await userEvent.keyboard("{Enter}");
						await waitForContent("2");
						await expectActiveTrigger(2);
						await expectPositionerAlignedWith(2);

						if (setup().Close) {
							await userEvent.click(page.getByText("Close popup"));
							await waitForPopupClosed();
							// Focus returns to the element that opened the popup.
							await vi.waitFor(() => {
								expect(openTrigger2).toHaveFocus();
							});
						} else {
							await userEvent.click(closeExternally);
							await waitForPopupClosed();
						}
						await expectActiveTrigger(null);
					});

					it.runIf(setup().Viewport)(
						"does not leave an inline scale style on the popup after switching triggers",
						async () => {
							globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;

							try {
								const onOpenChange = vi.fn();
								await renderFixture({
									mode,
									handle: getHandle(),
									rootProps: { onOpenChange },
									withViewport: true,
								});

								await openWith(switchInteraction(), 1);
								await waitForContent("1");

								await switchTrigger(switchInteraction(), 2);
								await waitForContent("2");

								// The trigger changed while the popup stayed open, rather than closing and
								// reopening.
								expect(onOpenChange).toHaveBeenCalled();
								expect(onOpenChange.mock.calls.map(([open]) => open)).not.toContain(false);
								// An inline scale would override CSS transitions on the popup.
								expect(popup().element().style.scale).toBe("");
							} finally {
								globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
							}
						},
					);
				});
			},
		);

		describe("detached triggers", () => {
			describe("imperative actions on the handle", () => {
				it("opens by trigger id with its payload and closes", async () => {
					const handle = setup().createHandle();
					await renderFixture({ mode: "detached", handle });

					expect(popup().query()).toBe(null);
					expect(handle.isOpen).toBe(false);

					handle.open("trigger-2");
					await waitForContent("2");
					expect(handle.isOpen).toBe(true);
					await expectActiveTrigger(2);

					handle.close();
					await waitForPopupClosed();
					expect(handle.isOpen).toBe(false);
					await expectActiveTrigger(null);
				});

				// The member's kind decides which of the two cases it runs; the other is left out.
				if (setup().throwOnMissingTrigger) {
					it("throws when opened with an unregistered trigger id", async () => {
						const handle = setup().createHandle();
						await renderFixture({ mode: "detached", handle });

						expect(() => handle.open("missing")).toThrow(
							'was called with the trigger id "missing", but no matching trigger is registered',
						);
						expect(handle.isOpen).toBe(false);
					});
				} else {
					it("opens unassociated with a warning when opened with an unregistered trigger id", async () => {
						const handle = setup().createHandle();
						await renderFixture({ mode: "detached", handle });

						const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
						try {
							handle.open("missing");
							flushSync();
							expect(countWarnings(consoleWarn, 'No trigger found with id "missing"')).toBe(1);
						} finally {
							consoleWarn.mockRestore();
						}

						await waitForPopupOpen();
						expect(handle.isOpen).toBe(true);
						await expectActiveTrigger(null);
					});
				}
			});

			describe("root ownership", () => {
				it("ignores imperative calls while no root is attached and follows the root across remounts", async () => {
					const handle = setup().createHandle();
					const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

					try {
						handle.open("trigger-1");
						handle.close();
						expect(handle.isOpen).toBe(false);
						expect(countWarnings(consoleWarn, "no root using this handle is mounted")).toBe(2);

						const screen = await renderFixture({ mode: "detached", handle, rootMounted: true });
						expect(popup().query()).toBe(null);
						expect(rootPayload().element().textContent).toBe("No payload");

						handle.open("trigger-1");
						await waitForContent("1");
						expect(handle.isOpen).toBe(true);

						// Unmounting the root while open detaches it from the handle.
						await screen.rerender({ rootMounted: false });
						expect(handle.isOpen).toBe(false);
						expect(popup().query()).toBe(null);

						// Each warning is logged once per message.
						consoleWarn.mockClear();
						handle.open("trigger-1");
						handle.close();
						expect(handle.isOpen).toBe(false);
						expect(countWarnings(consoleWarn, "no root using this handle is mounted")).toBe(0);

						// A remounted root starts closed, without the previous payload, and is controllable.
						await screen.rerender({ rootMounted: true });
						expect(popup().query()).toBe(null);
						expect(rootPayload().element().textContent).toBe("No payload");

						handle.open("trigger-2");
						await waitForContent("2");
						expect(handle.isOpen).toBe(true);
					} finally {
						consoleWarn.mockRestore();
					}
				});

				it("registers a detached trigger declared after the root", async () => {
					await renderFixture({
						mode: "detached",
						handle: setup().createHandle(),
						rootFirst: true,
					});

					await openWith(primaryInteraction(), 2);
					await waitForContent("2");
					await expectActiveTrigger(2);
				});

				it("resolves a trigger still registered to the previous root during a transient overlap", async () => {
					const handle = setup().createHandle();
					const openErrors: unknown[] = [];
					const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

					function openOnMount() {
						try {
							handle.open("trigger-2");
						} catch (error) {
							openErrors.push(error);
						}
					}

					try {
						// The detached trigger settles into the outgoing root's store (it is no longer in the
						// fallback map). The incoming root then attaches while the outgoing one is still
						// mounted, and an effect in that same update opens by trigger id, before the trigger
						// has migrated to the incoming root's store.
						const { Root, Trigger, Portal, Positioner, Popup, triggerProps } = setup();
						const screen = await render(ConformanceDetachedOverlap, {
							Root,
							Trigger,
							Portal,
							Positioner,
							Popup,
							triggerProps,
							handle,
							phase: "outgoing",
							openOnMount,
						});
						await screen.rerender({ phase: "overlap" });

						expect(openErrors).toEqual([]);
						expect(countWarnings(consoleWarn, "No trigger found")).toBe(0);
						expect(handle.isOpen).toBe(true);
						await expect.element(getTrigger(2)).toHaveAttribute("data-popup-open");
						await expect.element(getTrigger(1)).not.toHaveAttribute("data-popup-open");

						// Completing the handoff (the outgoing root unmounts) keeps the popup open and
						// associated.
						await screen.rerender({ phase: "incoming" });
						expect(handle.isOpen).toBe(true);
						await expect.element(getTrigger(2)).toHaveAttribute("data-popup-open");
						await expect.element(getTrigger(1)).not.toHaveAttribute("data-popup-open");
					} finally {
						consoleWarn.mockRestore();
					}
				});
			});

			describe("reparenting", () => {
				async function expectOpensAndCloses() {
					await openWith(primaryInteraction(), 1);
					await waitForPopupOpen();
					await expectActiveTrigger(1, 1);
					await closeWith(primaryInteraction(), 1);
					await waitForPopupClosed();
				}

				it.each([
					{ name: "when wrappers are removed", nestings: [3, 2, 1, 0], recreateHandle: false },
					{ name: "when wrappers are added", nestings: [0, 1, 2, 3], recreateHandle: false },
					{ name: "when the handle is re-created", nestings: [1, 1, 1], recreateHandle: true },
					{
						name: "when reparented with a re-created handle",
						nestings: [3, 2, 1, 0],
						recreateHandle: true,
					},
				])("keeps a detached trigger working $name", async ({ nestings, recreateHandle }) => {
					const [initialNesting, ...nextNestings] = nestings;
					const screen = await renderFixture({
						mode: "detached",
						handle: setup().createHandle(),
						triggerCount: 1,
						nesting: initialNesting,
					});

					await expectOpensAndCloses();

					for (const nesting of nextNestings) {
						await screen.rerender(
							recreateHandle ? { nesting, handle: setup().createHandle() } : { nesting },
						);
						await expectOpensAndCloses();
					}
				});
			});
		});
	});
}
