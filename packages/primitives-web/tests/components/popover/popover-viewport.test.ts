// Popover.Viewport: the `current` container, the popup's anchoring per side and direction, and the
// morphing containers while the popup moves between triggers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import type { PopoverRootChangeEventDetails, Side } from "#lib/components/popover/popover-types.js";

import { nextFrame } from "../../kit/kit-frames.js";
import PopoverViewport, { type ViewportTestTrigger } from "./fixtures/popover-viewport.svelte";

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
function getActivationDirectionTokens(viewport: Element) {
	return (viewport.getAttribute("data-activation-direction") ?? "").split(" ").filter(Boolean);
}

const previous = () => document.querySelector<HTMLElement>("[data-previous]");
const current = () => document.querySelector<HTMLElement>("[data-current]");
const activate = (testId: string) => userEvent.click(page.getByTestId(testId));

describe("Popover.Viewport", () => {
	it("renders children in the `current` container by default", async () => {
		await render(PopoverViewport, {
			open: true,
			triggers: [{ text: "Trigger" }],
			viewport: { "data-testid": "viewport" } as never,
			content: "content",
		});

		await expect.element(page.getByTestId("content")).toBeInTheDocument();
		const currentContainer = page.getByTestId("content").element().closest("[data-current]");
		expect(currentContainer).not.toBe(null);
		expect(currentContainer!.textContent).toBe("Content");
		expect(document.querySelector("[data-previous]")).toBe(null);

		const viewport = page.getByTestId("viewport");
		await expect.element(viewport).not.toHaveAttribute("data-transitioning");
		await expect.element(viewport).not.toHaveAttribute("data-activation-direction");
	});

	it("remounts the `current` container when the active trigger changes", async () => {
		await render(PopoverViewport, {
			triggers: [
				{ payload: "first", testId: "trigger1", text: "Trigger 1" },
				{ payload: "second", testId: "trigger2", text: "Trigger 2" },
			],
			content: "images",
		});

		await activate("trigger1");

		await expect.element(page.getByTestId("payload-image-1")).toBeInTheDocument();
		const firstContainer = page.getByTestId("payload-image-1").element().closest("[data-current]");
		expect(firstContainer).not.toBe(null);

		await activate("trigger2");

		await expect
			.poll(() => page.getByTestId("payload-image-2").query()?.closest("[data-current]") ?? null)
			.not.toBe(null);
		expect(page.getByTestId("payload-image-2").element().closest("[data-current]")).not.toBe(
			firstContainer,
		);
	});

	it.each([{ strict: false }])(
		"does not restart a transition when the active trigger remounts while closed and retained (strict: $strict)",
		async () => {
			const triggers = (key: string): ViewportTestTrigger[] => [
				{ key, id: "trigger", text: "Trigger" },
			];
			const screen = await render(PopoverViewport, {
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

			await expect.element(page.getByTestId("popup")).toBeInTheDocument();
			await userEvent.keyboard("{Escape}");
			await expect.element(page.getByTestId("popup")).toHaveAttribute("data-closed");

			await screen.rerender({ triggers: triggers("b") });

			await expect.element(page.getByTestId("popup")).toHaveAttribute("data-closed");
			await expect.element(page.getByTestId("viewport")).not.toHaveAttribute("data-transitioning");
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
			await render(PopoverViewport, {
				direction,
				open: true,
				triggers: [{ text: "Trigger" }],
				positioner: { side, collisionAvoidance: { side: "none" } },
				popup: { "data-testid": "popup" } as never,
				content: "text",
			});

			await expect.element(page.getByTestId("popup")).toBeInTheDocument();
			const { style } = page.getByTestId("popup").element() as HTMLElement;
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
			return render(PopoverViewport, {
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
			await renderPositionedTriggers({ top: 10, left: 10 }, { top: 100, left: 200 }, "0.3s");

			await activate("trigger1");
			await expect.element(page.getByText("Content 0")).toBeVisible();
			const viewport = page.getByTestId("viewport");
			await expect.element(viewport).not.toHaveAttribute("data-transitioning");
			await expect.element(viewport).not.toHaveAttribute("data-activation-direction");

			await activate("trigger2");

			await expect.poll(previous).not.toBe(null);
			const previousContainer = previous();

			await expect.element(viewport).toHaveAttribute("data-transitioning", "");
			expect(getActivationDirectionTokens(viewport.element())).toEqual(["right", "down"]);
			expect(previousContainer).toHaveAttribute("inert");
			expect(previousContainer!.textContent).toBe("Content 0");
			expect(previousContainer!.style.getPropertyValue("--popup-width")).toMatch(
				/^\d+(?:\.\d+)?px$/,
			);
			expect(previousContainer!.style.getPropertyValue("--popup-height")).toMatch(
				/^\d+(?:\.\d+)?px$/,
			);

			const currentContainer = current();
			expect(currentContainer).not.toBe(null);
			expect(currentContainer!.textContent).toBe("Content 1");

			// The previous container is removed once the animations finish.
			await expect.poll(previous).toBe(null);

			await expect.element(viewport).not.toHaveAttribute("data-transitioning");
			expect(document.querySelector("[data-current]")).toBeVisible();
			await expect.element(page.getByText("Content 1")).toBeVisible();
		});

		it("sets `data-activation-direction` from the previous to the new trigger", async () => {
			// `getActivationDirection`'s own tests cover every direction and the tolerance. This case
			// checks the measured trigger centers reach the attribute.
			await renderPositionedTriggers({ top: 100, left: 200 }, { top: 10, left: 10 }, "0.2s");

			await activate("trigger1");
			await expect.element(page.getByText("Content 0")).toBeVisible();

			await activate("trigger2");

			await expect
				.poll(() => getActivationDirectionTokens(page.getByTestId("viewport").element()))
				.toEqual(["left", "up"]);
		});

		it("creates morphing containers after a kept-mounted popup closes and reopens", async () => {
			const screen = await render(PopoverViewport, {
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

			await activate("trigger1");
			await expect.element(page.getByText("Content 0")).toBeVisible();

			await activate("trigger2");
			await expect.poll(previous).not.toBe(null);
			await expect.poll(previous).toBe(null);

			await screen.rerender({ open: false });
			// `toBeVisible` turns false once the exit animation reaches opacity 0, before the exit
			// completes, so also wait for the ending state to clear before reopening.
			await expect.element(page.getByTestId("popup")).not.toBeVisible();
			await expect.element(page.getByTestId("popup")).not.toHaveAttribute("data-ending-style");

			await activate("trigger1");
			await expect.element(page.getByText("Content 0")).toBeVisible();

			await activate("trigger2");

			await expect.poll(previous).not.toBe(null);
			const previousContainer = previous();

			expect(previousContainer!.textContent).toBe("Content 0");
			await expect.element(page.getByText("Content 1")).toBeVisible();
		});

		it("shows the latest content after rapid trigger changes", async () => {
			await render(PopoverViewport, {
				css: getMorphAnimationStyles("0.2s"),
				triggers: [
					{ payload: 1, testId: "trigger1", text: "Trigger 1" },
					{ payload: 2, testId: "trigger2", text: "Trigger 2" },
					{ payload: 3, testId: "trigger3", text: "Trigger 3" },
				],
				content: "text",
			});

			await activate("trigger1");
			await activate("trigger2");
			await activate("trigger3");
			await activate("trigger1");

			await expect.element(page.getByText("Content 1")).toBeVisible();
		});

		it("keeps the latest transition active during rapid trigger changes", async () => {
			await render(PopoverViewport, {
				css: getMorphAnimationStyles("10s"),
				triggers: [
					{ payload: 1, testId: "trigger1", text: "Trigger 1" },
					{ payload: 2, testId: "trigger2", text: "Trigger 2" },
					{ payload: 3, testId: "trigger3", text: "Trigger 3" },
				],
				viewport: { "data-testid": "viewport" } as never,
				content: "text",
			});

			await activate("trigger1");
			await expect.element(page.getByText("Content 1")).toBeVisible();
			await activate("trigger2");

			await expect
				.poll(() => page.getByText("Content 2").query()?.closest("[data-current]")?.getAnimations())
				.toHaveLength(1);
			// Let the viewport begin waiting for the animations before the current container is
			// replaced.
			await nextFrame();

			await activate("trigger3");
			await nextFrame();

			const currentContainer = page.getByText("Content 3").element().closest("[data-current]");
			expect(currentContainer?.getAnimations()).toHaveLength(1);
			await expect.element(page.getByTestId("viewport")).toHaveAttribute("data-transitioning", "");
			expect(document.querySelector("[data-previous]")).toHaveTextContent("Content 2");

			// A frame after the switch, the containers move from starting to ending styles.
			await vi.waitFor(() => {
				expect(document.querySelector("[data-previous]")).toHaveAttribute("data-ending-style", "");
			});
			expect(page.getByText("Content 3").element().closest("[data-current]")).not.toHaveAttribute(
				"data-starting-style",
			);
		});

		// The snapshot is the content shown before the switch, whichever container showed it and
		// however long that container takes to leave the document.
		it("snapshots the last shown content when the replaced container plays an outro", async () => {
			await render(PopoverViewport, {
				css: getMorphAnimationStyles("0.2s"),
				triggers: [1, 2, 3].map((n) => ({
					payload: n,
					testId: `trigger${n}`,
					text: `Trigger ${n}`,
				})),
				content: "fade",
			});

			await activate("trigger1");
			await expect.element(page.getByText("Content 1")).toBeInTheDocument();

			await activate("trigger2");
			await expect.poll(previous).not.toBe(null);
			// Settled: the snapshot is gone and the outroing container has left the document.
			await vi.waitFor(() => {
				expect(document.querySelector("[data-previous]")).toBe(null);
				expect(document.querySelectorAll("[data-current]")).toHaveLength(1);
			});

			await activate("trigger3");
			await expect.poll(previous).not.toBe(null);
			expect(document.querySelector("[data-previous]")).toHaveTextContent("Content 2");
		});

		it("snapshots the content shown before the switch, not the new container's", async () => {
			await render(PopoverViewport, {
				css: getMorphAnimationStyles("0.2s"),
				triggers: [
					{ payload: 1, testId: "trigger1", text: "Trigger 1" },
					{ payload: 2, testId: "trigger2", text: "Trigger 2" },
				],
				content: "instance",
			});

			await activate("trigger1");
			await expect.poll(current).not.toBe(null);
			const shown = current()!.textContent;

			await activate("trigger2");
			await expect.poll(previous).not.toBe(null);
			expect(document.querySelector("[data-previous]")!.textContent).toBe(shown);
			expect(document.querySelector("[data-current]")!.textContent).not.toBe(shown);
		});

		it("snapshots the current content when the active trigger's element is replaced after a lagging payload", async () => {
			const triggers = (payload: string, key: string): ViewportTestTrigger[] => [
				{ id: "trigger1", payload: "X", testId: "trigger1", text: "Trigger 1" },
				{ key, id: "trigger2", payload, testId: "trigger2", text: "Trigger 2" },
			];
			const screen = await render(PopoverViewport, {
				css: getMorphAnimationStyles("0.2s"),
				triggers: triggers("X", "a"),
				content: "text",
			});

			await activate("trigger1");
			await expect.element(page.getByText("Content X")).toBeVisible();

			// Same payload: the content waits for the second trigger's payload.
			await activate("trigger2");
			await expect.poll(previous).not.toBe(null);

			// The payload arrives and re-creates the current container.
			await screen.rerender({ triggers: triggers("Y", "a") });
			await expect.poll(previous).toBe(null);
			expect(document.querySelector("[data-current]")).toHaveTextContent("Content Y");

			// A new element with the same id becomes the active trigger: a switch from the content
			// shown now.
			await screen.rerender({ triggers: triggers("Y", "b") });
			await expect.poll(previous).not.toBe(null);
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
			const screen = await render(PopoverViewport, {
				css: morphTransitionStyles,
				triggers: triggers(undefined),
				viewport: { "data-testid": "viewport" } as never,
				content: "text",
			});

			await activate("trigger1");
			await expect.poll(current).not.toBe(null);

			await activate("trigger2");

			// The morph is in progress: the previous snapshot exists and both containers are running
			// their (long) transitions.
			await expect.poll(previous).not.toBe(null);
			await expect
				.poll(() => document.querySelector("[data-previous]")?.getAnimations().length)
				.toBeGreaterThanOrEqual(1);
			await expect
				.poll(() => document.querySelector("[data-current]")?.getAnimations().length)
				.toBeGreaterThanOrEqual(1);

			// Let the viewport begin waiting for the animations before the container is replaced.
			await nextFrame();
			await nextFrame();

			const containerBeforePayload = document.querySelector("[data-current]");

			// The payload for the already-active trigger arrives a render later, which bumps the
			// content key and remounts the current container mid-morph.
			await screen.rerender({ triggers: triggers("ready") });

			await expect.poll(current).not.toBe(containerBeforePayload);
			expect(document.querySelector("[data-current]")!.textContent).toBe("Content ready");

			// The remounted container must restart its entry transition, otherwise the cleanup
			// watcher finds nothing to await and truncates the exit transition.
			await expect
				.poll(() => document.querySelector("[data-current]")?.getAnimations().length)
				.toBeGreaterThanOrEqual(1);

			// The previous container's exit transition is still running, so it must not have been torn
			// down in the frames right after the remount.
			await nextFrame();
			await nextFrame();
			await nextFrame();
			await nextFrame();
			expect(document.querySelector("[data-previous]")).not.toBe(null);

			// Finish the live animations so the cleanup watcher can settle.
			await vi.waitFor(() => {
				document.querySelectorAll("[data-previous], [data-current]").forEach((element) => {
					element.getAnimations().forEach((animation) => animation.finish());
				});
				expect(document.querySelector("[data-previous]")).toBe(null);
			});

			await expect.element(page.getByTestId("viewport")).not.toHaveAttribute("data-transitioning");
		});
	});
});
