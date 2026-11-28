// The focus manager's Tab bridge inside an iframe: a non-modal Popover whose Portal renders into
// the iframe's root (fixtures/focus-iframe-popover.svelte), mounted there with Svelte's `mount`.
// jest-dom's `toBeInTheDocument` rejects an element of the iframe's window, so the check is
// `isConnected`. Focus moves on real frames, so the checks wait with `waitFor`.

import testingUserEvent from "@testing-library/user-event";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import { act, waitFor, within } from "../../shim/index.js";
import IframePopover from "./fixtures/focus-iframe-popover.svelte";

// `toHaveFocus` doesn't follow focus into nested documents.
function isFocused(element: Element): boolean {
	let doc = element.ownerDocument;
	let current: Element = element;

	while (doc) {
		if (doc.activeElement !== current) {
			return false;
		}

		// Move up to the parent document
		const frame = doc.defaultView?.frameElement; // the <iframe> hosting this doc
		if (!frame) {
			return true;
		}

		current = frame;
		doc = frame.ownerDocument;
	}

	return true;
}

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** Outside links around an iframe whose document renders the popover. */
async function renderIframeApp() {
	const outer = document.body.appendChild(document.createElement("div"));
	const before = document.createElement("a");
	before.href = "#outside-1";
	before.textContent = "Outside link 1";
	const innerRoot = document.createElement("div");
	innerRoot.id = "innerRoot";
	const after = document.createElement("a");
	after.href = "#outside-2";
	after.textContent = "Outside link 2";
	outer.append(before, innerRoot, after);

	const iframe = document.createElement("iframe");
	iframe.setAttribute("data-testid", "iframe");
	iframe.src = "about:blank";
	iframe.style.height = "300px";
	innerRoot.appendChild(iframe);

	// Properly open, write, and close the iframe document.
	const iframeDoc = iframe.contentWindow!.document;
	iframeDoc.open();
	iframeDoc.write(`<div id="rootIframe"></div>`);
	iframeDoc.close();

	const root = iframeDoc.getElementById("rootIframe")!;
	const component = mount(IframePopover, { target: root, props: { container: root } });
	flushSync();
	cleanup = () => {
		unmount(component);
		outer.remove();
	};
	await act(async () => {});

	// The popover renders inside an iframe and the renderer's `user` is bound to the
	// top-level document, so user-event needs an instance for the iframe's document.
	const setup = testingUserEvent.setup({ document: iframeDoc });
	const user = {
		async click(element: Element) {
			await setup.click(element);
			flushSync();
		},
		async tab(options?: { shift?: boolean }) {
			await setup.tab(options);
			flushSync();
		},
	};
	return { iframeWithin: within(iframeDoc.body), user };
}

describe("FloatingFocusManager", () => {
	describe("iframe focus navigation", () => {
		it("tabs from the popover to the next element in the iframe", async () => {
			const { iframeWithin, user } = await renderIframeApp();

			await user.click(iframeWithin.getByRole("button", { name: "Open" }));

			expect(iframeWithin.getByTestId("popover").isConnected).toBe(true);
			await waitFor(() => {
				expect(isFocused(iframeWithin.getByText("popover link 1"))).toBe(true);
			});

			await user.tab();
			await user.tab();

			await waitFor(() => {
				expect(isFocused(iframeWithin.getByText("next iframe link"))).toBe(true);
			});
		});

		it("shift+tab from the popover to the previous element in the iframe", async () => {
			const { iframeWithin, user } = await renderIframeApp();

			await user.click(iframeWithin.getByRole("button", { name: "Open" }));

			expect(iframeWithin.getByTestId("popover").isConnected).toBe(true);
			await waitFor(() => {
				expect(isFocused(iframeWithin.getByText("popover link 1"))).toBe(true);
			});

			await user.tab({ shift: true });

			await waitFor(() => {
				expect(isFocused(iframeWithin.getByRole("button", { name: "Open" }))).toBe(true);
			});
		});
	});
});
