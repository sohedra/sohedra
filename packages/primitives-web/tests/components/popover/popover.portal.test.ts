// The portal moves its element into the container while it stays in its Svelte component
// tree. Removing a popover must never remove the container's other children, across Svelte's
// block boundaries ({#each}, {#if} component swaps, {#key}, nesting, keepMounted, render
// snippets and container changes).

import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRenderer, screen, flushAfterMicrotask } from "../../shim/index.js";
import PortalInto from "./fixtures/popover-portal-into.svelte";
import PortalRenderSwap from "./fixtures/popover-portal-render-swap.svelte";

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

beforeEach(() => {
	container = document.createElement("div");
	container.innerHTML = '<span data-sentinel="">first</span><span data-sentinel="">second</span>';
	document.body.append(container);
});

afterEach(() => {
	container.remove();
});

describe("Popover.Portal (in-tree node move)", () => {
	const { render } = createRenderer();

	it("renders every open popup into the container, after its other children", async () => {
		await render(PortalInto, { container });
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled()).toEqual(["popup-a", "popup-b", "popup-c", "popup-swap-off", "popup-key-0"]);
		expect(container.firstElementChild?.textContent).toBe("first");
	});

	it("keeps the container's other children when a keyed {#each} item is removed and reordered", async () => {
		const { setProps } = await render(PortalInto, { container });
		await setProps({ items: ["a", "c"] });
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled()).toEqual(["popup-a", "popup-c", "popup-swap-off", "popup-key-0"]);

		await setProps({ items: ["c", "a", "d"] });
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled().sort()).toEqual(
			["popup-a", "popup-c", "popup-d", "popup-swap-off", "popup-key-0"].sort(),
		);
		// The triggers moved with their items; the popups stay where they were portalled.
		expect(
			Array.from(screen.getByTestId("each").querySelectorAll("button"), (b) => b.textContent),
		).toEqual(["Trigger c", "Trigger a", "Trigger d"]);

		await setProps({ items: [] });
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled()).toEqual(["popup-swap-off", "popup-key-0"]);
	});

	it("keeps the container's other children across an {#if} component swap and a {#key} change", async () => {
		const { setProps } = await render(PortalInto, { container, items: [] });
		await setProps({ swap: true });
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled()).toEqual(["popup-key-0", "popup-swap-on"]);

		await setProps({ keyValue: 1 });
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled()).toEqual(["popup-swap-on", "popup-key-1"]);

		await setProps({ swap: false, keyValue: 2 });
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled().sort()).toEqual(["popup-key-2", "popup-swap-off"]);
	});

	it("removes a nested popover's portal with its parent's, and nothing else", async () => {
		const { setProps } = await render(PortalInto, { container, nested: true });
		await flushAfterMicrotask();
		expect(screen.getByTestId("popup-nested")).toBeInTheDocument();
		expect(screen.getByTestId("popup-nested").closest("[data-sohedra-portal]")?.parentElement).toBe(
			container,
		);

		await setProps({ items: ["b", "c"] });
		expect(screen.queryByTestId("popup-nested")).toBe(null);
		expect(screen.queryByTestId("popup-a")).toBe(null);
		expect(sentinels()).toEqual(["first", "second"]);
		expect(container.querySelectorAll(":scope > [data-sohedra-portal]")).toHaveLength(4);
	});

	it("closes and reopens every popover without touching the container's other children", async () => {
		const { setProps } = await render(PortalInto, { container, nested: true });
		await setProps({ open: false });
		expect(portalled()).toEqual([]);
		expect(container.children).toHaveLength(2);
		expect(sentinels()).toEqual(["first", "second"]);

		await setProps({ open: true });
		// The nested popover (defaultOpen) remounts open with its parent.
		expect(portalled()).toHaveLength(6);
		expect(sentinels()).toEqual(["first", "second"]);
	});

	it("keeps a keepMounted portal in the container while closed, and removes it on unmount", async () => {
		const { setProps, unmount } = await render(PortalInto, {
			container,
			items: ["a"],
			keepMounted: true,
			open: false,
		});
		expect(portalled()).toContain("popup-a");
		expect(screen.getByTestId("popup-a").closest("[data-closed]")).not.toBe(null);
		await setProps({ open: true });
		await setProps({ open: false });
		expect(portalled()).toContain("popup-a");
		unmount();
		expect(portalled()).toEqual([]);
		expect(sentinels()).toEqual(["first", "second"]);
	});

	it("delivers delegated events inside the portal and reads context from outside it", async () => {
		const onclickInside = vi.fn();
		await render(PortalInto, { container, items: ["a"], onclickInside });
		screen.getByText("Inside a").click();
		expect(onclickInside).toHaveBeenCalledWith("a");
		expect(screen.getAllByTestId("context")[0]).toHaveTextContent("context value");
	});

	// One popover per test below: re-creating an open popup returns focus to its trigger, and
	// several open non-modal popovers would then close each other on focus out.
	it("supports a render snippet, and switching it on and off while open", async () => {
		const { setProps } = await render(PortalInto, {
			container,
			items: ["a"],
			renderPortal: true,
			sections: ["each"],
		});
		expect(container.querySelector(":scope > section[data-sohedra-portal]")).not.toBe(null);
		await setProps({ renderPortal: false });
		expect(container.querySelector(":scope > section")).toBe(null);
		expect(container.querySelector(":scope > div[data-sohedra-portal]")).not.toBe(null);
		await setProps({ renderPortal: true });
		expect(container.querySelector(":scope > section[data-sohedra-portal]")).not.toBe(null);
		expect(sentinels()).toEqual(["first", "second"]);
		expect(portalled()).toEqual(["popup-a"]);
	});

	it("swaps between two render snippets while open without disturbing either tree", async () => {
		const { setProps } = await render(PortalRenderSwap, { container, mode: "section" });
		const texts = () => Array.from(document.querySelectorAll("p"), (p) => p.textContent);
		expect(container.querySelector(":scope > section")).not.toBe(null);
		await setProps({ mode: "article" });
		expect(container.querySelector(":scope > section")).toBe(null);
		expect(container.querySelector(":scope > article")).not.toBe(null);
		await setProps({ mode: "none" });
		expect(container.querySelector(":scope > article")).toBe(null);
		expect(container.querySelector(":scope > div[data-sohedra-portal]")).not.toBe(null);
		expect(sentinels()).toEqual(["first", "second"]);
		expect(texts()).toEqual(["before", "after"]);
		expect(screen.getByTestId("popup")).toBeInTheDocument();
	});

	it("moves the portal when its container changes, leaving both containers' children", async () => {
		const other = document.createElement("div");
		other.innerHTML = '<span data-sentinel="">other</span>';
		document.body.append(other);
		try {
			const { setProps } = await render(PortalInto, {
				container,
				items: ["a"],
				sections: ["each"],
			});
			await setProps({ container: other });
			flushSync();
			expect(other.querySelector(":scope > [data-sohedra-portal] [data-testid=popup-a]")).not.toBe(
				null,
			);
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
			await render(PortalInto, {
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
