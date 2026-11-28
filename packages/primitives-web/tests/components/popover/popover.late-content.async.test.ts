// Content that arrives after the popover opens, in Svelte's async mode (`pnpm test:async`; the
// sync run excludes this file). An `await` inside the popup without a boundary delays the open
// until it resolves; with a `<svelte:boundary>` and a `pending` snippet, the popup opens right
// away and the content appears later. The library adds nothing for it, but has to cope.
//
// The expectation: initial focus is resolved once, a microtask after the open, so content that
// appears later doesn't take focus; the Viewport re-measures on payload changes only.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createRenderer, screen, waitFor } from "../../shim/index.js";
import LateContentPopover from "./fixtures/async/popover-late-content.svelte";
import LateDescriptionPopover from "./fixtures/async/popover-late-description.svelte";
import LateViewportPopover from "./fixtures/async/popover-late-viewport.svelte";

function deferred() {
	return Promise.withResolvers<string>();
}

describe("Popover with content that arrives after open", () => {
	const { render } = createRenderer();

	it("opens right away with the pending content, then shows the content", async () => {
		const content = deferred();
		const { user } = await render(LateContentPopover, { promise: content.promise });

		await user.click(screen.getByTestId("trigger"));

		await waitFor(() => {
			expect(screen.getByTestId("popup")).toHaveAttribute("data-open");
		});
		expect(screen.getByTestId("pending")).toBeVisible();
		expect(screen.queryByTestId("late-content")).toBe(null);

		await act(async () => content.resolve("Late"));

		await waitFor(() => {
			expect(screen.getByTestId("late-button")).toHaveTextContent("Late");
		});
		expect(screen.queryByTestId("pending")).toBe(null);
		expect(screen.getByTestId("popup")).toHaveAttribute("data-open");
	});

	describe("initial focus", () => {
		it("focuses the popup when its only tabbable element hasn't arrived yet", async () => {
			const content = deferred();
			const { user } = await render(LateContentPopover, { promise: content.promise });

			await user.click(screen.getByTestId("trigger"));
			const popup = await screen.findByTestId("popup");
			await waitFor(() => {
				expect(popup).toHaveFocus();
			});

			await act(async () => content.resolve("Late"));
			await screen.findByTestId("late-button");

			// Focus stays where the open put it; the content is a Tab away.
			expect(popup).toHaveFocus();
			await user.keyboard("[Tab]");
			expect(screen.getByTestId("late-button")).toHaveFocus();
		});

		it("falls back to the popup when the `initialFocus` target hasn't arrived yet", async () => {
			const content = deferred();
			const { user } = await render(LateContentPopover, {
				promise: content.promise,
				focusLate: true,
			});

			await user.click(screen.getByTestId("trigger"));
			const popup = await screen.findByTestId("popup");
			await waitFor(() => {
				expect(popup).toHaveFocus();
			});

			await act(async () => content.resolve("Late"));
			await screen.findByTestId("late-button");

			// While pending, the target already exists off the document, so `initialFocus` returns it
			// but it can't take focus: the popup does. `initialFocus` is
			// resolved once per open, so the target doesn't take focus when it arrives either.
			expect(popup).toHaveFocus();
		});

		it("focuses the `initialFocus` target when the content is already there", async () => {
			const content = deferred();
			content.resolve("Ready");
			const { user } = await render(LateContentPopover, {
				promise: content.promise,
				focusLate: true,
			});

			await user.click(screen.getByTestId("trigger"));

			await waitFor(() => {
				expect(screen.getByTestId("late-button")).toHaveFocus();
			});
		});
	});

	it("keeps the popup anchored as the content grows", async () => {
		const content = deferred();
		const { user } = await render(LateContentPopover, {
			promise: content.promise,
			positioner: { side: "top", sideOffset: 0 },
			triggerStyle: "margin-top: 400px",
		});
		const trigger = screen.getByTestId("trigger");

		await user.click(trigger);
		const popup = await screen.findByTestId("popup");
		await waitFor(() => {
			expect(popup.getBoundingClientRect().bottom).toBeCloseTo(
				trigger.getBoundingClientRect().top,
				0,
			);
		});
		const pendingHeight = popup.getBoundingClientRect().height;

		await act(async () => content.resolve("Late"));
		await screen.findByTestId("late-button");

		// The popup grew upwards: its bottom edge still meets the trigger, and it stays on screen.
		await waitFor(() => {
			expect(popup.getBoundingClientRect().height).toBeGreaterThan(pendingHeight);
			expect(popup.getBoundingClientRect().bottom).toBeCloseTo(
				trigger.getBoundingClientRect().top,
				0,
			);
		});
		expect(popup.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
	});

	it("lets a Viewport popup take the size of content that grows", async () => {
		const content = deferred();
		const { user } = await render(LateContentPopover, {
			promise: content.promise,
			viewport: true,
		});

		await user.click(screen.getByTestId("trigger"));
		const popup = await screen.findByTestId("popup");
		await waitFor(() => {
			expect(popup.style.getPropertyValue("--popup-height")).toBe("auto");
		});

		await act(async () => content.resolve("Late"));
		const lateContent = await screen.findByTestId("late-content");

		// The Viewport re-measures on payload changes only: no size animation, and the popup's size
		// variables stay `auto`, so the popup follows its content.
		await waitFor(() => {
			expect(popup.getBoundingClientRect().height).toBeGreaterThanOrEqual(
				lateContent.getBoundingClientRect().height,
			);
		});
		expect(popup.style.getPropertyValue("--popup-width")).toBe("auto");
		expect(popup.style.getPropertyValue("--popup-height")).toBe("auto");
		expect(document.querySelector("[data-previous]")).toBe(null);
		expect(screen.getByTestId("viewport")).not.toHaveAttribute("data-transitioning");
	});

	it("keeps the Positioner's size variables at the size measured on open", async () => {
		const content = deferred();
		const { user } = await render(LateContentPopover, {
			promise: content.promise,
			viewport: true,
		});

		await user.click(screen.getByTestId("trigger"));
		const positioner = await screen.findByTestId("positioner");
		await waitFor(() => {
			expect(positioner.style.getPropertyValue("--positioner-height")).toMatch(/px$/);
		});
		const measured = positioner.style.getPropertyValue("--positioner-height");

		await act(async () => content.resolve("Late"));
		const lateContent = await screen.findByTestId("late-content");

		// Measured again only when the payload changes. A Positioner sized with
		// `var(--positioner-height)` keeps the pending content's height.
		expect(lateContent.getBoundingClientRect().height).toBe(200);
		expect(positioner.style.getPropertyValue("--positioner-height")).toBe(measured);
		expect(parseFloat(measured)).toBeLessThan(200);
	});

	// While it loads in a pending boundary the Description isn't in the document, so it claims no id.
	it("doesn't point `aria-describedby` at a Description that is still loading", async () => {
		const content = deferred();
		const { user } = await render(LateDescriptionPopover, { promise: content.promise });

		await user.click(screen.getByTestId("trigger"));
		const popup = await screen.findByTestId("popup");
		await screen.findByTestId("pending");
		await waitFor(() => {
			expect(popup).toHaveAttribute("aria-labelledby", screen.getByTestId("title").id);
		});
		expect(popup).not.toHaveAttribute("aria-describedby");

		await act(async () => content.resolve("Bio"));

		const description = await screen.findByTestId("description");
		await waitFor(() => {
			expect(popup).toHaveAttribute("aria-describedby", description.id);
		});
	});

	describe("Viewport switch to content that is still loading", () => {
		const slowMorph = `
      [data-transitioning] [data-previous],
      [data-transitioning] [data-current] {
        transition: opacity 10s linear;
      }
      [data-transitioning] [data-previous][data-ending-style],
      [data-transitioning] [data-current][data-starting-style] {
        opacity: 0;
      }
    `;

		beforeEach(() => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
		});

		afterEach(() => {
			globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
		});

		/** `load(payload)` pending until the test resolves that payload's promise. */
		function createLoader() {
			const loads = new Map<number, PromiseWithResolvers<string>>();
			const get = (payload: number) => {
				let load = loads.get(payload);
				if (!load) {
					load = deferred();
					loads.set(payload, load);
				}
				return load;
			};
			return {
				// The popup can render once before the payload arrives.
				load: (payload: number | undefined) =>
					payload === undefined ? Promise.resolve("") : get(payload).promise,
				resolve: (payload: number) => get(payload).resolve(`A ${payload}`),
			};
		}

		function previousText() {
			return document.querySelector("[data-previous]")?.textContent ?? null;
		}

		it("snapshots the shown content while the next content loads", async () => {
			const loader = createLoader();
			loader.resolve(1);
			const { user } = await render(LateViewportPopover, {
				payloads: [1, 2],
				load: loader.load,
				css: slowMorph,
			});

			await user.click(screen.getByTestId("trigger1"));
			await screen.findByText("A 1");

			await user.click(screen.getByTestId("trigger2"));
			await waitFor(() => {
				expect(previousText()).toBe("A 1");
			});

			await act(async () => loader.resolve(2));
			await waitFor(() => {
				expect(document.querySelector("[data-current]")).toHaveTextContent("A 2");
			});
			expect(previousText()).toBe("A 1");
		});
	});
});
