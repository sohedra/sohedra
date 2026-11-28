// Popover.Portal: its element moves into the container but stays in its component tree, so
// removing a popover never removes the container's other children across Svelte's blocks; a
// Portal removed while open; and the user's handlers on the Portal and the Positioner.
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { nextFrame, nextTask, settle } from "../../kit/kit-frames.js";
import PopoverDemo from "./fixtures/popover-demo.svelte";
import PopoverPortalInto from "./fixtures/popover-portal-into.svelte";
import PopoverPortalRenderSwap from "./fixtures/popover-portal-render-swap.svelte";
import PopoverRemovedPortal from "./fixtures/popover-removed-portal.svelte";

let container: HTMLElement;

function sentinels() {
	return Array.from(container.querySelectorAll(":scope > [data-sentinel]")).map(
		(node) => node.textContent,
	);
}

function portalled() {
	return Array.from(container.querySelectorAll(":scope > [data-sohedra-portal]")).map(
		(node) => node.querySelector("[data-testid^=popup-]")?.getAttribute("data-testid") ?? "?",
	);
}

describe("Popover.Portal", () => {
	describe("into a container with other children", () => {
		beforeEach(() => {
			container = document.createElement("div");
			container.innerHTML =
				'<span data-sentinel="">first</span><span data-sentinel="">second</span>';
			document.body.append(container);
		});

		afterEach(() => {
			container.remove();
		});

		it("renders every open popup into the container, after its other children", async () => {
			await render(PopoverPortalInto, { container });
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled()).toEqual([
				"popup-a",
				"popup-b",
				"popup-c",
				"popup-swap-off",
				"popup-key-0",
			]);
			expect(container.firstElementChild?.textContent).toBe("first");
		});

		it("keeps the container's other children when a keyed {#each} item is removed and reordered", async () => {
			const screen = await render(PopoverPortalInto, { container });
			await screen.rerender({ items: ["a", "c"] });
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled()).toEqual(["popup-a", "popup-c", "popup-swap-off", "popup-key-0"]);

			await screen.rerender({ items: ["c", "a", "d"] });
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled().sort()).toEqual(
				["popup-a", "popup-c", "popup-d", "popup-swap-off", "popup-key-0"].sort(),
			);
			// The triggers moved with their items; the popups stay where they were portalled.
			expect(
				Array.from(
					page.getByTestId("each").element().querySelectorAll("button"),
					(b) => b.textContent,
				),
			).toEqual(["Trigger c", "Trigger a", "Trigger d"]);

			await screen.rerender({ items: [] });
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled()).toEqual(["popup-swap-off", "popup-key-0"]);
		});

		it("keeps the container's other children across an {#if} component swap and a {#key} change", async () => {
			const screen = await render(PopoverPortalInto, { container, items: [] });
			await screen.rerender({ swap: true });
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled()).toEqual(["popup-key-0", "popup-swap-on"]);

			await screen.rerender({ keyValue: 1 });
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled()).toEqual(["popup-swap-on", "popup-key-1"]);

			await screen.rerender({ swap: false, keyValue: 2 });
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled().sort()).toEqual(["popup-key-2", "popup-swap-off"]);
		});

		it("removes a nested popover's portal with its parent's, and nothing else", async () => {
			const screen = await render(PopoverPortalInto, { container, nested: true });
			await settle();
			await expect.element(page.getByTestId("popup-nested")).toBeInTheDocument();
			expect(
				page.getByTestId("popup-nested").element().closest("[data-sohedra-portal]")?.parentElement,
			).toBe(container);

			await screen.rerender({ items: ["b", "c"] });
			expect(page.getByTestId("popup-nested").query()).toBe(null);
			expect(page.getByTestId("popup-a").query()).toBe(null);
			expect(sentinels()).toEqual(["first", "second"]);
			expect(container.querySelectorAll(":scope > [data-sohedra-portal]")).toHaveLength(4);
		});

		it("closes and reopens every popover without touching the container's other children", async () => {
			const screen = await render(PopoverPortalInto, { container, nested: true });
			await screen.rerender({ open: false });
			expect(portalled()).toEqual([]);
			expect(container.children).toHaveLength(2);
			expect(sentinels()).toEqual(["first", "second"]);

			await screen.rerender({ open: true });
			// The nested popover (defaultOpen) remounts open with its parent.
			expect(portalled()).toHaveLength(6);
			expect(sentinels()).toEqual(["first", "second"]);
		});

		it("keeps a keepMounted portal in the container while closed, and removes it on unmount", async () => {
			const screen = await render(PopoverPortalInto, {
				container,
				items: ["a"],
				keepMounted: true,
				open: false,
			});
			expect(portalled()).toContain("popup-a");
			expect(page.getByTestId("popup-a").element().closest("[data-closed]")).not.toBe(null);
			await screen.rerender({ open: true });
			await screen.rerender({ open: false });
			expect(portalled()).toContain("popup-a");
			await screen.unmount();
			expect(portalled()).toEqual([]);
			expect(sentinels()).toEqual(["first", "second"]);
		});

		it("delivers delegated events inside the portal and reads context from outside it", async () => {
			const onclickInside = vi.fn();
			await render(PopoverPortalInto, { container, items: ["a"], onclickInside });
			await userEvent.click(page.getByText("Inside a"));
			expect(onclickInside).toHaveBeenCalledWith("a");
			await expect.element(page.getByTestId("context").first()).toHaveTextContent("context value");
		});

		// One popover per case below: re-creating an open popup returns focus to its trigger, and
		// several open non-modal popovers would then close each other on focus out.
		it("supports a render snippet, and switching it on and off while open", async () => {
			const screen = await render(PopoverPortalInto, {
				container,
				items: ["a"],
				renderPortal: true,
				sections: ["each"],
			});
			expect(container.querySelector(":scope > section[data-sohedra-portal]")).not.toBe(null);
			await screen.rerender({ renderPortal: false });
			expect(container.querySelector(":scope > section")).toBe(null);
			expect(container.querySelector(":scope > div[data-sohedra-portal]")).not.toBe(null);
			await screen.rerender({ renderPortal: true });
			expect(container.querySelector(":scope > section[data-sohedra-portal]")).not.toBe(null);
			expect(sentinels()).toEqual(["first", "second"]);
			expect(portalled()).toEqual(["popup-a"]);
		});

		it("swaps between two render snippets while open without disturbing either tree", async () => {
			const screen = await render(PopoverPortalRenderSwap, { container, mode: "section" });
			const texts = () => Array.from(document.querySelectorAll("p"), (p) => p.textContent);
			expect(container.querySelector(":scope > section")).not.toBe(null);
			await screen.rerender({ mode: "article" });
			expect(container.querySelector(":scope > section")).toBe(null);
			expect(container.querySelector(":scope > article")).not.toBe(null);
			await screen.rerender({ mode: "none" });
			expect(container.querySelector(":scope > article")).toBe(null);
			expect(container.querySelector(":scope > div[data-sohedra-portal]")).not.toBe(null);
			expect(sentinels()).toEqual(["first", "second"]);
			expect(texts()).toEqual(["before", "after"]);
			await expect.element(page.getByTestId("popup")).toBeInTheDocument();
		});

		it("moves the portal when its container changes, leaving both containers' children", async () => {
			const other = document.createElement("div");
			other.innerHTML = '<span data-sentinel="">other</span>';
			document.body.append(other);
			try {
				const screen = await render(PopoverPortalInto, {
					container,
					items: ["a"],
					sections: ["each"],
				});
				await screen.rerender({ container: other });
				flushSync();
				expect(
					other.querySelector(":scope > [data-sohedra-portal] [data-testid=popup-a]"),
				).not.toBe(null);
				expect(container.querySelector("[data-testid=popup-a]")).toBe(null);
				expect(sentinels()).toEqual(["first", "second"]);
				expect(other.firstElementChild?.textContent).toBe("other");
			} finally {
				other.remove();
			}
		});

		it("warns in development when the render snippet renders more than one root", async () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				await render(PopoverPortalInto, {
					container,
					items: ["a"],
					renderPortal: true,
					multiRoot: true,
					sections: ["each"],
				});
				expect(warn).toHaveBeenCalledWith(
					expect.stringContaining("must render exactly one root element"),
				);
			} finally {
				warn.mockRestore();
			}
		});
	});

	describe("removed while its popover is open", () => {
		// A close afterwards has no popup to wait for, so it never completes: the Root waits on the
		// popup element and does nothing without one.
		it("doesn't complete a close without a popup", async () => {
			const onOpenChangeComplete = vi.fn();
			await render(PopoverRemovedPortal, { onOpenChangeComplete });
			const trigger = page.getByRole("button", { name: "Toggle" });

			await userEvent.click(trigger);
			await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true));
			await userEvent.click(page.getByRole("button", { name: "Remove" }));
			expect(page.getByTestId("popup").query()).toBe(null);
			expect(trigger.element().getAttribute("aria-expanded")).toBe("true");

			await userEvent.click(trigger);
			expect(trigger.element().getAttribute("aria-expanded")).toBe("false");
			// A close completes in the frame or task after it; none comes here.
			await nextFrame();
			await nextFrame();
			await nextTask();
			expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
		});
	});

	// The portal element sits outside the app's root, where Svelte's delegated handlers run from
	// the document: a listener the popup adds on the way must not mark the event handled there.
	describe("with the user's own handlers", () => {
		it("runs a focusout and a pointerdown handler on the Portal and on the Positioner", async () => {
			const portal = { onfocusout: vi.fn(), onpointerdown: vi.fn() };
			const positioner = { onfocusout: vi.fn(), onpointerdown: vi.fn() };
			await render(PopoverDemo, {
				portalProps: portal,
				positionerProps: positioner,
				close: "Close",
				outsideButton: "Outside",
			});

			await userEvent.click(page.getByRole("button", { name: "Toggle" }));
			await expect.element(page.getByRole("button", { name: "Close" })).toHaveFocus();
			await userEvent.click(page.getByRole("dialog"));
			expect(positioner.onpointerdown).toHaveBeenCalledTimes(1);
			expect(portal.onpointerdown).toHaveBeenCalledTimes(1);

			await userEvent.click(page.getByRole("button", { name: "Outside" }));
			expect(positioner.onfocusout).toHaveBeenCalled();
			expect(portal.onfocusout).toHaveBeenCalled();
		});
	});
});
