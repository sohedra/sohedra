// New cases: Escape pressed right after a text composition ended. One browser engine reports
// the end of a composition before the key that ended it, so there the end counts a little
// longer and that key is not the popup's. The others mark that key themselves, so an Escape
// that follows the end at once is an ordinary one and closes the popup.
// - The popup is the initially open Popover of the other dismiss cases
//   (fixtures/dismiss-popover.svelte); `input` is the field in it.

import { describe, expect, it } from "vitest";
import { server } from "vitest/browser";

import { act, createRenderer, fireEvent, screen } from "../../shim/index.js";
import DismissPopover from "./fixtures/dismiss-popover.svelte";

const flushMicrotasks = () => act(async () => {});

const floating = () => screen.queryByTestId("floating");

const isWebKit = server.browser === "webkit";

describe("Escape right after a composition ended", () => {
	const { render } = createRenderer();

	async function setup() {
		await render(DismissPopover);
		const input = screen.getByTestId("input");
		await act(async () => input.focus());
		fireEvent.compositionStart(input);
		fireEvent.compositionEnd(input);
		return input;
	}

	it.skipIf(isWebKit)(
		"closes the popup where the key that ends a composition is marked",
		async () => {
			const input = await setup();

			fireEvent.keyDown(input, { key: "Escape" });
			await flushMicrotasks();

			expect(floating()).not.toBeInTheDocument();
		},
	);

	it.skipIf(!isWebKit)("stays open where the end is reported before its key", async () => {
		const input = await setup();

		fireEvent.keyDown(input, { key: "Escape" });
		await flushMicrotasks();
		expect(floating()).toBeInTheDocument();

		// A later Escape is the popup's again.
		await new Promise((resolve) => {
			setTimeout(resolve, 10);
		});
		fireEvent.keyDown(input, { key: "Escape" });
		await flushMicrotasks();
		expect(floating()).not.toBeInTheDocument();
	});
});
