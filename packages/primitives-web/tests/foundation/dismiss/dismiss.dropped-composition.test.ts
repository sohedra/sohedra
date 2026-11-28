// New cases: a text composition the browser drops without telling. Removing the field that is
// composing, or rewriting its text, ends the composition with no `compositionend`, so a
// composition counted from its start to its end never ends, and Escape stops closing the popup.
// The key event says itself whether it belongs to a composition.
// - The popup is the initially open Popover of the other dismiss cases
//   (fixtures/dismiss-popover.svelte); `input` is the field in it.

import { describe, expect, it } from "vitest";

import { act, createRenderer, fireEvent, screen } from "../../shim/index.js";
import DismissPopover from "./fixtures/dismiss-popover.svelte";

const flushMicrotasks = () => act(async () => {});

const floating = () => screen.queryByTestId("floating");

describe("Escape after a composition that never ended", () => {
	const { render } = createRenderer();

	it("closes the popup once the composing field is gone", async () => {
		await render(DismissPopover);
		const input = screen.getByTestId("input");
		await act(async () => input.focus());

		fireEvent.compositionStart(input);
		// The field is rewritten and the browser drops the composition: no `compositionend`.
		fireEvent.keyDown(document.body, { key: "Escape" });
		await flushMicrotasks();

		expect(floating()).not.toBeInTheDocument();
	});

	it("stays open for an Escape that says it belongs to a composition", async () => {
		await render(DismissPopover);
		const input = screen.getByTestId("input");
		await act(async () => input.focus());

		fireEvent.keyDown(input, { key: "Escape", isComposing: true });
		await flushMicrotasks();
		expect(floating()).toBeInTheDocument();

		// The key code input methods report for a key they handle themselves.
		fireEvent.keyDown(input, { key: "Escape", keyCode: 229 });
		await flushMicrotasks();
		expect(floating()).toBeInTheDocument();
	});
});
