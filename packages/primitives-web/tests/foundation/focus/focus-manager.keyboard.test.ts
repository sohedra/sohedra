// The focus manager's Tab handling: a popup that traps focus, with Tab pressed faster than a
// frame, and the Tab bridge between a trigger and its portalled popup inside an iframe.
// - Trapping: a Popover with `modal="trap-focus"` and a Popover.Close (fixtures/focus-popover.svelte)
//   holds a `child` button and the close button, with a `before` and an `after` button outside.
//   The guards around the popup send focus back to its other end; that has to happen as the guard
//   takes focus, because a Tab pressed before the next frame starts from wherever focus is. The
//   frames are held, so no frame can run between two key presses.
// - The iframe: a non-modal Popover whose Portal renders into the iframe's root
//   (fixtures/focus-iframe-popover.svelte), mounted there. `toHaveFocus` doesn't follow focus
//   into a nested document, so the checks read each document's active element.
import { describe, expect, it, onTestFinished } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { holdFrames } from "../../kit/kit-frames.js";
import IframePopover from "./fixtures/focus-iframe-popover.svelte";
import FocusPopover from "./fixtures/focus-popover.svelte";

/** Whether `element` has focus, through every document up to the page's. */
function isFocused(element: Element | null): boolean {
	let doc = element?.ownerDocument;
	let current = element;
	while (doc && current) {
		if (doc.activeElement !== current) {
			return false;
		}
		const frame = doc.defaultView?.frameElement;
		if (!frame) {
			return true;
		}
		current = frame;
		doc = frame.ownerDocument;
	}
	return false;
}

describe("FocusManager", () => {
	describe("a popup that traps focus, with Tab pressed faster than a frame", () => {
		async function setup() {
			const screen = await render(FocusPopover, {
				rootProps: { modal: "trap-focus" },
				withClose: true,
				before: true,
				after: true,
			});
			await userEvent.click(screen.getByTestId("anchor"));
			const child = screen.getByTestId("child");
			await expect.element(child).toHaveFocus();
			return { child, close: screen.getByTestId("popup-close") };
		}

		it("wraps to the first element and goes on from there", async () => {
			const { child, close } = await setup();
			holdFrames();

			await userEvent.keyboard("{Tab}");
			await expect.element(close).toHaveFocus();
			// Past the last element: back to the first one, with no frame in between.
			await userEvent.keyboard("{Tab}");
			await expect.element(child).toHaveFocus();
			await userEvent.keyboard("{Tab}");
			await expect.element(close).toHaveFocus();
		});

		it("wraps to the last element with Shift+Tab and goes on from there", async () => {
			const { child, close } = await setup();
			holdFrames();

			await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
			await expect.element(close).toHaveFocus();
			await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
			await expect.element(child).toHaveFocus();
			await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
			await expect.element(close).toHaveFocus();
		});
	});

	describe("iframe focus navigation", () => {
		/** Outside links around an iframe whose document renders the popover. */
		async function setup() {
			const outer = document.body.appendChild(document.createElement("div"));
			outer.innerHTML = `<a href="#outside-1">Outside link 1</a><div></div><a href="#outside-2">Outside link 2</a>`;
			const iframe = outer.children[1]!.appendChild(document.createElement("iframe"));
			iframe.style.height = "300px";
			const iframeDoc = iframe.contentWindow!.document;
			iframeDoc.open();
			iframeDoc.write(`<div id="rootIframe"></div>`);
			iframeDoc.close();
			const root = iframeDoc.getElementById("rootIframe")!;
			await render(IframePopover, { target: root, props: { container: root } });
			// The outside links and the iframe are removed when the test ends.
			onTestFinished(() => outer.remove());

			const frame = page.frameLocator(page.elementLocator(iframe));
			const link = (name: string) => iframeDoc.querySelector(`a[href="#${name}"]`);
			return { iframeDoc, frame, link };
		}

		it("tabs from the popover to the next element in the iframe", async () => {
			const { iframeDoc, frame, link } = await setup();

			await userEvent.click(frame.getByRole("button", { name: "Open" }));

			await expect
				.poll(() => iframeDoc.querySelector('[data-testid="popover"]')?.isConnected)
				.toBe(true);
			await expect.poll(() => isFocused(link("one"))).toBe(true);

			await userEvent.tab();
			await userEvent.tab();

			await expect.poll(() => isFocused(link("next"))).toBe(true);
		});

		it("goes back from the popover to its trigger in the iframe with Shift+Tab", async () => {
			const { iframeDoc, frame, link } = await setup();

			await userEvent.click(frame.getByRole("button", { name: "Open" }));

			await expect
				.poll(() => iframeDoc.querySelector('[data-testid="popover"]')?.isConnected)
				.toBe(true);
			await expect.poll(() => isFocused(link("one"))).toBe(true);

			await userEvent.tab({ shift: true });

			await expect
				.poll(() => isFocused(iframeDoc.querySelector("button[aria-haspopup]")))
				.toBe(true);
		});
	});
});
