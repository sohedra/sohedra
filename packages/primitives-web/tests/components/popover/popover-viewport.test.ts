// The shared viewport conformance cases (`openOn: 'click'`), inlined for Popover. Each case renders
// fixtures/popover-viewport.svelte: a named content kind, a `direction` prop, a `css` prop for the
// styles, `setProps` to rerender, and a bindable `open`. The conformance suite runs the stateless
// checks (the viewport's state can't be set through props); the Portal renders after mount only, so
// its hydration check is `clientOnly`.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PopoverRootChangeEventDetails, Side } from "#lib/components/popover/popover-types.js";

import { describeConformance } from "../../conformance/describe-conformance.js";
import { act, createRenderer, screen, waitFor } from "../../shim/index.js";
import { popoverViewportConformance } from "./fixtures/popover-viewport-conformance.js";
import PartViewportPopover, { type ViewportTestTrigger } from "./fixtures/popover-viewport.svelte";

/** Waits one animation frame. */
const waitSingleFrame = () =>
	new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});

const morphTransitionStyles = `
  [data-transitioning] [data-current] {
    transition: transform 10s linear, opacity 10s linear;
  }
  [data-transitioning] [data-current][data-starting-style] {
    transform: translateX(30%);
    opacity: 0;
  }
  [data-transitioning] [data-previous] {
    transition: transform 10s linear, opacity 10s linear;
  }
  [data-transitioning] [data-previous][data-ending-style] {
    transform: translateX(-30%);
    opacity: 0;
  }
`;

function getMorphAnimationStyles(duration: string) {
	return `
    [data-transitioning] [data-previous] {
      animation: slide-out ${duration} ease-out forwards;
    }
    [data-transitioning] [data-current] {
      animation: slide-in ${duration} ease-out forwards;
    }
    @keyframes slide-out {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(-30%); opacity: 0; }
    }
    @keyframes slide-in {
      from { transform: translateX(30%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
}

interface TriggerPosition {
	top: number;
	left: number;
}

function getTriggerStyle({ top, left }: TriggerPosition) {
	return `position: absolute; top: ${top}px; left: ${left}px; width: 100px; height: 50px`;
}

/**
 * `data-activation-direction` is a space-separated token list matched with `~=` selectors, so
 * compare its tokens rather than the exact string.
 */
function getActivationDirectionTokens(viewport: HTMLElement) {
	return (viewport.getAttribute("data-activation-direction") ?? "").split(" ").filter(Boolean);
}

describe("<Popover.Viewport />", () => {
	const { render } = createRenderer();

	describeConformance("Popover.Viewport", () => popoverViewportConformance);

	type User = Awaited<ReturnType<typeof render>>["user"];

	async function activateTrigger(trigger: HTMLElement, user: User) {
		await user.click(trigger);
	}

	describe("Viewport conformance", () => {
		it("renders children in the `current` container by default", async () => {
			await render(PartViewportPopover, {
				open: true,
				triggers: [{ text: "Trigger" }],
				viewport: { "data-testid": "viewport" } as never,
				content: "content",
			});

			const currentContainer = screen.getByTestId("content").closest("[data-current]");
			expect(currentContainer).not.toBe(null);
			expect(currentContainer!.textContent).toBe("Content");
			expect(document.querySelector("[data-previous]")).toBe(null);

			const viewport = screen.getByTestId("viewport");
			expect(viewport).not.toHaveAttribute("data-transitioning");
			expect(viewport).not.toHaveAttribute("data-activation-direction");
		});

		it("remounts the `current` container when the active trigger changes", async () => {
			const { user } = await render(PartViewportPopover, {
				triggers: [
					{ payload: "first", testId: "trigger1", text: "Trigger 1" },
					{ payload: "second", testId: "trigger2", text: "Trigger 2" },
				],
				content: "images",
			});

			await activateTrigger(screen.getByTestId("trigger1"), user);

			const firstImage = await screen.findByTestId("payload-image-1");
			const firstContainer = firstImage.closest("[data-current]");
			expect(firstContainer).not.toBe(null);

			await activateTrigger(screen.getByTestId("trigger2"), user);

			await waitFor(() => {
				expect(screen.getByTestId("payload-image-2").closest("[data-current]")).not.toBe(null);
			});
			expect(screen.getByTestId("payload-image-2").closest("[data-current]")).not.toBe(
				firstContainer,
			);
		});

		it.each([{ strict: false }])(
			"does not restart a transition when the active trigger remounts while closed and retained (strict: $strict)",
			async () => {
				const triggers = (key: string): ViewportTestTrigger[] => [
					{ key, id: "trigger", text: "Trigger" },
				];
				const { user, setProps } = await render(PartViewportPopover, {
					root: {
						defaultOpen: true,
						defaultTriggerId: "trigger",
						onOpenChange: (open: boolean, eventDetails: PopoverRootChangeEventDetails) => {
							if (!open) {
								eventDetails.preventUnmountOnClose();
							}
						},
					},
					triggers: triggers("a"),
					popup: { "data-testid": "popup" } as never,
					viewport: { "data-testid": "viewport" } as never,
					content: "text",
				});

				await user.keyboard("[Escape]");
				await waitFor(() => {
					expect(screen.getByTestId("popup")).toHaveAttribute("data-closed");
				});

				await setProps({ triggers: triggers("b") });

				expect(screen.getByTestId("popup")).toHaveAttribute("data-closed");
				expect(screen.getByTestId("viewport")).not.toHaveAttribute("data-transitioning");
				expect(document.querySelector("[data-previous]")).toBe(null);
			},
		);

		it.each([
			{
				side: "top",
				direction: "ltr",
				expected: { position: "absolute", bottom: "0px", left: "0px" },
			},
			{
				side: "top",
				direction: "rtl",
				expected: { position: "absolute", bottom: "0px", left: "0px" },
			},
			{ side: "bottom", direction: "ltr", expected: {} },
			{ side: "bottom", direction: "rtl", expected: {} },
			{
				side: "left",
				direction: "ltr",
				expected: { position: "absolute", top: "0px", right: "0px" },
			},
			{
				side: "left",
				direction: "rtl",
				expected: { position: "absolute", top: "0px", right: "0px" },
			},
			{ side: "right", direction: "ltr", expected: {} },
			{ side: "right", direction: "rtl", expected: {} },
			{
				side: "inline-start",
				direction: "ltr",
				expected: { position: "absolute", top: "0px", right: "0px" },
			},
			{ side: "inline-start", direction: "rtl", expected: {} },
			{ side: "inline-end", direction: "ltr", expected: {} },
			{
				side: "inline-end",
				direction: "rtl",
				expected: { position: "absolute", top: "0px", right: "0px" },
			},
		] satisfies {
			side: Side;
			direction: "ltr" | "rtl";
			expected: Partial<Record<"position" | "top" | "right" | "bottom" | "left", string>>;
		}[])(
			"anchors the popup for side=$side in $direction mode",
			async ({ side, direction, expected }) => {
				await render(PartViewportPopover, {
					direction,
					open: true,
					triggers: [{ text: "Trigger" }],
					positioner: { side, collisionAvoidance: { side: "none" } },
					popup: { "data-testid": "popup" } as never,
					content: "text",
				});

				const { style } = screen.getByTestId("popup");
				expect(style.position).toBe(expected.position ?? "");
				expect(style.top).toBe(expected.top ?? "");
				expect(style.right).toBe(expected.right ?? "");
				expect(style.bottom).toBe(expected.bottom ?? "");
				expect(style.left).toBe(expected.left ?? "");
			},
		);

		describe("morphing containers", () => {
			beforeEach(() => {
				globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
			});

			afterEach(() => {
				globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
			});

			function renderPositionedTriggers(
				first: TriggerPosition,
				second: TriggerPosition,
				animationDuration: string,
			) {
				return render(PartViewportPopover, {
					css: getMorphAnimationStyles(animationDuration),
					triggers: [
						{ payload: 0, testId: "trigger1", style: getTriggerStyle(first), text: "Trigger 1" },
						{ payload: 1, testId: "trigger2", style: getTriggerStyle(second), text: "Trigger 2" },
					],
					viewport: { "data-testid": "viewport" } as never,
					content: "numbered",
				});
			}

			it("creates morphing containers during transitions", async () => {
				const { user } = await renderPositionedTriggers(
					{ top: 10, left: 10 },
					{ top: 100, left: 200 },
					"0.3s",
				);

				await activateTrigger(screen.getByTestId("trigger1"), user);
				await waitFor(() => {
					expect(screen.getByText("Content 0")).toBeVisible();
				});
				const viewport = screen.getByTestId("viewport");
				expect(viewport).not.toHaveAttribute("data-transitioning");
				expect(viewport).not.toHaveAttribute("data-activation-direction");

				await activateTrigger(screen.getByTestId("trigger2"), user);

				let previousContainer: HTMLElement | null = null;
				await waitFor(() => {
					previousContainer = document.querySelector("[data-previous]");
					expect(previousContainer).not.toBe(null);
				});

				expect(viewport).toHaveAttribute("data-transitioning", "");
				expect(getActivationDirectionTokens(viewport)).toEqual(["right", "down"]);
				expect(previousContainer).toHaveAttribute("inert");
				expect(previousContainer!.textContent).toBe("Content 0");
				expect(previousContainer!.style.getPropertyValue("--popup-width")).toMatch(
					/^\d+(?:\.\d+)?px$/,
				);
				expect(previousContainer!.style.getPropertyValue("--popup-height")).toMatch(
					/^\d+(?:\.\d+)?px$/,
				);

				const currentContainer = document.querySelector("[data-current]");
				expect(currentContainer).not.toBe(null);
				expect(currentContainer!.textContent).toBe("Content 1");

				// The previous container is removed once the animations finish.
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).toBe(null);
				});

				expect(viewport).not.toHaveAttribute("data-transitioning");
				expect(document.querySelector("[data-current]")).toBeVisible();
				expect(screen.getByText("Content 1")).toBeVisible();
			});

			it("sets `data-activation-direction` from the previous to the new trigger", async () => {
				// `getActivationDirection` unit tests cover every direction and the tolerance.
				// This case checks the measured trigger centers reach the attribute.
				const { user } = await renderPositionedTriggers(
					{ top: 100, left: 200 },
					{ top: 10, left: 10 },
					"0.2s",
				);

				await activateTrigger(screen.getByTestId("trigger1"), user);
				await waitFor(() => {
					expect(screen.getByText("Content 0")).toBeVisible();
				});

				await activateTrigger(screen.getByTestId("trigger2"), user);

				await waitFor(() => {
					expect(getActivationDirectionTokens(screen.getByTestId("viewport"))).toEqual([
						"left",
						"up",
					]);
				});
			});

			it("creates morphing containers after a kept-mounted popup closes and reopens", async () => {
				const { user, setProps } = await render(PartViewportPopover, {
					open: false,
					css: getMorphAnimationStyles("0.2s"),
					triggers: [
						{ payload: 0, testId: "trigger1", text: "Trigger 1" },
						{ payload: 1, testId: "trigger2", text: "Trigger 2" },
					],
					portal: { keepMounted: true },
					popup: { "data-testid": "popup" } as never,
					content: "text",
				});

				const trigger1 = screen.getByTestId("trigger1");
				const trigger2 = screen.getByTestId("trigger2");

				await activateTrigger(trigger1, user);
				await waitFor(() => {
					expect(screen.getByText("Content 0")).toBeVisible();
				});

				await activateTrigger(trigger2, user);
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).not.toBe(null);
				});
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).toBe(null);
				});

				await act(async () => setProps({ open: false }));
				// `toBeVisible` turns false once the exit animation reaches opacity 0, before the exit
				// completes, so also wait for the ending state to clear before reopening.
				await waitFor(() => {
					expect(screen.getByTestId("popup")).not.toBeVisible();
				});
				await waitFor(() => {
					expect(screen.getByTestId("popup")).not.toHaveAttribute("data-ending-style");
				});

				await activateTrigger(trigger1, user);
				await waitFor(() => {
					expect(screen.getByText("Content 0")).toBeVisible();
				});

				await activateTrigger(trigger2, user);

				let previousContainer: HTMLElement | null = null;
				await waitFor(() => {
					previousContainer = document.querySelector("[data-previous]");
					expect(previousContainer).not.toBe(null);
				});

				expect(previousContainer!.textContent).toBe("Content 0");
				expect(screen.getByText("Content 1")).toBeVisible();
			});

			it("shows the latest content after rapid trigger changes", async () => {
				const { user } = await render(PartViewportPopover, {
					css: getMorphAnimationStyles("0.2s"),
					triggers: [
						{ payload: 1, testId: "trigger1", text: "Trigger 1" },
						{ payload: 2, testId: "trigger2", text: "Trigger 2" },
						{ payload: 3, testId: "trigger3", text: "Trigger 3" },
					],
					content: "text",
				});

				const trigger1 = screen.getByTestId("trigger1");

				await activateTrigger(trigger1, user);
				await activateTrigger(screen.getByTestId("trigger2"), user);
				await activateTrigger(screen.getByTestId("trigger3"), user);
				await activateTrigger(trigger1, user);

				const content = await screen.findByText("Content 1");
				await waitFor(() => {
					expect(content).toBeVisible();
				});
			});

			it("keeps the latest transition active during rapid trigger changes", async () => {
				const { user } = await render(PartViewportPopover, {
					css: getMorphAnimationStyles("10s"),
					triggers: [
						{ payload: 1, testId: "trigger1", text: "Trigger 1" },
						{ payload: 2, testId: "trigger2", text: "Trigger 2" },
						{ payload: 3, testId: "trigger3", text: "Trigger 3" },
					],
					viewport: { "data-testid": "viewport" } as never,
					content: "text",
				});

				await activateTrigger(screen.getByTestId("trigger1"), user);
				await waitFor(() => {
					expect(screen.getByText("Content 1")).toBeVisible();
				});
				await activateTrigger(screen.getByTestId("trigger2"), user);

				await waitFor(() => {
					expect(
						screen.getByText("Content 2").closest("[data-current]")?.getAnimations(),
					).toHaveLength(1);
				});
				// Allow `useAnimationsFinished` to begin waiting before replacing the current container.
				await waitSingleFrame();

				await activateTrigger(screen.getByTestId("trigger3"), user);
				await waitSingleFrame();

				const currentContainer = screen.getByText("Content 3").closest("[data-current]");
				expect(currentContainer?.getAnimations()).toHaveLength(1);
				expect(screen.getByTestId("viewport")).toHaveAttribute("data-transitioning", "");
				expect(document.querySelector("[data-previous]")).toHaveTextContent("Content 2");

				// A frame after the switch, the containers move from starting to ending styles.
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).toHaveAttribute(
						"data-ending-style",
						"",
					);
				});
				expect(screen.getByText("Content 3").closest("[data-current]")).not.toHaveAttribute(
					"data-starting-style",
				);
			});

			// The snapshot is the content shown before the switch, whichever container showed it and
			// however long that container takes to leave the document.
			it("snapshots the last shown content when the replaced container plays an outro", async () => {
				const { user } = await render(PartViewportPopover, {
					css: getMorphAnimationStyles("0.2s"),
					triggers: [1, 2, 3].map((n) => ({
						payload: n,
						testId: `trigger${n}`,
						text: `Trigger ${n}`,
					})),
					content: "fade",
				});

				await activateTrigger(screen.getByTestId("trigger1"), user);
				await waitFor(() => {
					expect(screen.getByText("Content 1")).toBeInTheDocument();
				});

				await activateTrigger(screen.getByTestId("trigger2"), user);
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).not.toBe(null);
				});
				// Settled: the snapshot is gone and the outroing container has left the document.
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).toBe(null);
					expect(document.querySelectorAll("[data-current]")).toHaveLength(1);
				});

				await activateTrigger(screen.getByTestId("trigger3"), user);
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).not.toBe(null);
				});
				expect(document.querySelector("[data-previous]")).toHaveTextContent("Content 2");
			});

			it("snapshots the content shown before the switch, not the new container's", async () => {
				const { user } = await render(PartViewportPopover, {
					css: getMorphAnimationStyles("0.2s"),
					triggers: [
						{ payload: 1, testId: "trigger1", text: "Trigger 1" },
						{ payload: 2, testId: "trigger2", text: "Trigger 2" },
					],
					content: "instance",
				});

				await activateTrigger(screen.getByTestId("trigger1"), user);
				await waitFor(() => {
					expect(document.querySelector("[data-current]")).not.toBe(null);
				});
				const shown = document.querySelector("[data-current]")!.textContent;

				await activateTrigger(screen.getByTestId("trigger2"), user);
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).not.toBe(null);
				});
				expect(document.querySelector("[data-previous]")!.textContent).toBe(shown);
				expect(document.querySelector("[data-current]")!.textContent).not.toBe(shown);
			});

			it("snapshots the current content when the active trigger's element is replaced after a lagging payload", async () => {
				const triggers = (payload: string, key: string): ViewportTestTrigger[] => [
					{ id: "trigger1", payload: "X", testId: "trigger1", text: "Trigger 1" },
					{ key, id: "trigger2", payload, testId: "trigger2", text: "Trigger 2" },
				];
				const { user, setProps } = await render(PartViewportPopover, {
					css: getMorphAnimationStyles("0.2s"),
					triggers: triggers("X", "a"),
					content: "text",
				});

				await activateTrigger(screen.getByTestId("trigger1"), user);
				await waitFor(() => {
					expect(screen.getByText("Content X")).toBeVisible();
				});

				// Same payload: the content waits for the second trigger's payload.
				await activateTrigger(screen.getByTestId("trigger2"), user);
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).not.toBe(null);
				});

				// The payload arrives and re-creates the current container.
				await act(async () => setProps({ triggers: triggers("Y", "a") }));
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).toBe(null);
				});
				expect(document.querySelector("[data-current]")).toHaveTextContent("Content Y");

				// A new element with the same id becomes the active trigger: a switch from the content
				// shown now.
				await act(async () => setProps({ triggers: triggers("Y", "b") }));
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).not.toBe(null);
				});
				expect(document.querySelector("[data-previous]")).toHaveTextContent("Content Y");
				expect(document.querySelector("[data-current]")).toHaveTextContent("Content Y");
			});

			it("cleans up the transition when a lagging payload remounts the current container", async () => {
				const triggers = (payload2: string | undefined): ViewportTestTrigger[] => [
					{ testId: "trigger1", style: getTriggerStyle({ top: 10, left: 10 }), text: "Trigger 1" },
					{
						payload: payload2,
						testId: "trigger2",
						style: getTriggerStyle({ top: 100, left: 200 }),
						text: "Trigger 2",
					},
				];
				const { user, setProps } = await render(PartViewportPopover, {
					css: morphTransitionStyles,
					triggers: triggers(undefined),
					viewport: { "data-testid": "viewport" } as never,
					content: "text",
				});

				await activateTrigger(screen.getByTestId("trigger1"), user);
				await waitFor(() => {
					expect(document.querySelector("[data-current]")).not.toBe(null);
				});

				await activateTrigger(screen.getByTestId("trigger2"), user);

				// The morph is in progress: the previous snapshot exists and both containers
				// are running their (long) transitions.
				await waitFor(() => {
					expect(document.querySelector("[data-previous]")).not.toBe(null);
				});
				await waitFor(() => {
					expect(
						document.querySelector("[data-previous]")?.getAnimations().length,
					).toBeGreaterThanOrEqual(1);
				});
				await waitFor(() => {
					expect(
						document.querySelector("[data-current]")?.getAnimations().length,
					).toBeGreaterThanOrEqual(1);
				});

				// Allow `useAnimationsFinished` to begin waiting before the container is replaced.
				await waitSingleFrame();
				await waitSingleFrame();

				const containerBeforePayload = document.querySelector("[data-current]");

				// The payload for the already-active trigger arrives a render later, which
				// bumps the content key and remounts the current container mid-morph.
				await act(async () => {
					await setProps({ triggers: triggers("ready") });
				});

				await waitFor(() => {
					expect(document.querySelector("[data-current]")).not.toBe(containerBeforePayload);
				});
				expect(document.querySelector("[data-current]")!.textContent).toBe("Content ready");

				// The remounted container must restart its entry transition, otherwise the
				// cleanup watcher finds nothing to await and truncates the exit transition.
				await waitFor(() => {
					expect(
						document.querySelector("[data-current]")?.getAnimations().length,
					).toBeGreaterThanOrEqual(1);
				});

				// The previous container's exit transition is still running, so it must not
				// have been torn down in the frames right after the remount.
				await waitSingleFrame();
				await waitSingleFrame();
				await waitSingleFrame();
				await waitSingleFrame();
				expect(document.querySelector("[data-previous]")).not.toBe(null);

				// Finish the live animations so the cleanup watcher can settle.
				await waitFor(async () => {
					await act(async () => {
						document.querySelectorAll("[data-previous], [data-current]").forEach((element) => {
							element.getAnimations().forEach((animation) => animation.finish());
						});
					});
					expect(document.querySelector("[data-previous]")).toBe(null);
				});

				await waitFor(() => {
					expect(screen.getByTestId("viewport")).not.toHaveAttribute("data-transitioning");
				});
			});
		});
	});
});
