// New cases: the focused element inside a popover is removed. Focus falls to the body, so the
// focus manager focuses the popup, and once more on the next frame, for the browsers that hand
// focus back to the removed element in between. That second focus must not take focus the app
// has moved somewhere else in the meantime. The frames are held, then run by the test, so the
// order is fixed.
// - WebKit fires no `focusout` when a focused element is removed, so the manager never hears of
//   the removal there; these cases run in Chromium only, like the other removal cases.

import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "vitest/browser";

import { act, createRenderer, screen, waitFor } from "../../shim/index.js";
import RemovalPopover from "./fixtures/focus-removal-popover.svelte";

/** Holds animation frames back; `run()` runs the ones requested so far. */
function holdFrames() {
	const pending = new Map<number, FrameRequestCallback>();
	let handle = 0;
	vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
		handle += 1;
		pending.set(handle, callback);
		return handle;
	});
	vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
		pending.delete(id);
	});
	return {
		run() {
			const callbacks = [...pending.values()];
			pending.clear();
			callbacks.forEach((callback) => callback(performance.now()));
		},
	};
}

describe.skipIf(server.browser === "webkit")("a focused element removed from a popover", () => {
	const { render } = createRenderer();

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function setup() {
		const { user, component } = await render(RemovalPopover);
		await user.click(screen.getByTestId("reference"));
		await waitFor(() => {
			expect(screen.getByTestId("remove")).toHaveFocus();
		});
		const frames = holdFrames();
		const popup = screen.getByTestId("floating");
		await act(async () => component.removeFocused());
		// Focus fell to the body and the popup took it.
		await waitFor(() => {
			expect(popup).toHaveFocus();
		});
		return { frames, popup };
	}

	it("leaves focus where the app moved it before the next frame", async () => {
		const { frames } = await setup();
		const other = screen.getByTestId("other");
		await act(async () => other.focus());

		await act(async () => frames.run());

		expect(other).toHaveFocus();
	});

	it("focuses the popup again when focus is lost again before the next frame", async () => {
		const { frames, popup } = await setup();
		await act(async () => popup.blur());
		expect(document.body).toHaveFocus();

		await act(async () => frames.run());

		expect(popup).toHaveFocus();
	});
});
