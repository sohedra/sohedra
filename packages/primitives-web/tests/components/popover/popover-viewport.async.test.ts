// Popover.Viewport with content that arrives after the popover opens, in Svelte's async mode (the
// sync run leaves this file out): the Viewport re-measures on payload changes only, and snapshots
// the shown content while the next content loads.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import PopoverLateContent from "./fixtures/popover-late-content.svelte";
import PopoverLateViewport from "./fixtures/popover-late-viewport.svelte";

describe("Popover.Viewport with content that arrives after open", () => {
	it("lets a Viewport popup take the size of content that grows", async () => {
		const content = Promise.withResolvers<string>();
		await render(PopoverLateContent, { promise: content.promise, viewport: true });

		await userEvent.click(page.getByTestId("trigger"));
		await expect.element(page.getByTestId("popup")).toBeInTheDocument();
		const popup = page.getByTestId("popup").element() as HTMLElement;
		await expect.poll(() => popup.style.getPropertyValue("--popup-height")).toBe("auto");

		content.resolve("Late");
		await expect.element(page.getByTestId("late-content")).toBeInTheDocument();
		const lateContent = page.getByTestId("late-content").element();

		// The Viewport re-measures on payload changes only: no size animation, and the popup's size
		// variables stay `auto`, so the popup follows its content.
		await vi.waitFor(() => {
			expect(popup.getBoundingClientRect().height).toBeGreaterThanOrEqual(
				lateContent.getBoundingClientRect().height,
			);
		});
		expect(popup.style.getPropertyValue("--popup-width")).toBe("auto");
		expect(popup.style.getPropertyValue("--popup-height")).toBe("auto");
		expect(document.querySelector("[data-previous]")).toBe(null);
		await expect.element(page.getByTestId("viewport")).not.toHaveAttribute("data-transitioning");
	});

	it("keeps the Positioner's size variables at the size measured on open", async () => {
		const content = Promise.withResolvers<string>();
		await render(PopoverLateContent, { promise: content.promise, viewport: true });

		await userEvent.click(page.getByTestId("trigger"));
		await expect.element(page.getByTestId("positioner")).toBeInTheDocument();
		const positioner = page.getByTestId("positioner").element() as HTMLElement;
		await expect
			.poll(() => positioner.style.getPropertyValue("--positioner-height"))
			.toMatch(/px$/);
		const measured = positioner.style.getPropertyValue("--positioner-height");

		content.resolve("Late");
		await expect.element(page.getByTestId("late-content")).toBeInTheDocument();
		const lateContent = page.getByTestId("late-content").element();

		// Measured again only when the payload changes. A Positioner sized with
		// `var(--positioner-height)` keeps the pending content's height.
		expect(lateContent.getBoundingClientRect().height).toBe(200);
		expect(positioner.style.getPropertyValue("--positioner-height")).toBe(measured);
		expect(parseFloat(measured)).toBeLessThan(200);
	});

	describe("on a switch to content that is still loading", () => {
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
					load = Promise.withResolvers<string>();
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

		/** Resolves at the first DOM change after which `holds()` is true (at once if it already is). */
		function domChange(holds: () => boolean) {
			return new Promise<void>((resolve) => {
				if (holds()) {
					resolve();
					return;
				}
				const observer = new MutationObserver(() => {
					if (holds()) {
						observer.disconnect();
						resolve();
					}
				});
				observer.observe(document.body, { subtree: true, childList: true, characterData: true });
			});
		}

		function previousText() {
			return document.querySelector("[data-previous]")?.textContent ?? null;
		}

		it("snapshots the shown content while the next content loads", async () => {
			const loader = createLoader();
			loader.resolve(1);
			await render(PopoverLateViewport, { payloads: [1, 2], load: loader.load, css: slowMorph });

			// The case reads the snapshot in the moments before the switch's `trigger-change` instant
			// turns the transitions off: script clicks, since a real click's round trip outlasts them
			// in Chromium, and waits that wake on the DOM change itself rather than on a poll.
			(page.getByTestId("trigger1").element() as HTMLElement).click();
			await expect.element(page.getByText("A 1")).toBeInTheDocument();

			(page.getByTestId("trigger2").element() as HTMLElement).click();
			await domChange(() => previousText() === "A 1");
			expect(previousText()).toBe("A 1");

			const shown = domChange(
				() => document.querySelector("[data-current]")?.textContent === "A 2",
			).then(previousText);
			loader.resolve(2);
			const previousAtSwitch = await shown;
			await vi.waitFor(() => {
				expect(document.querySelector("[data-current]")).toHaveTextContent("A 2");
			});
			expect(previousAtSwitch).toBe("A 1");
		});
	});
});
