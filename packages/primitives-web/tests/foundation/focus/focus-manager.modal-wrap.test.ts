// New cases: Tab held down in a popup that traps focus. The guards around the popup send focus
// back to the other end of it; that has to happen as the guard takes focus, because a Tab pressed
// before the next frame starts from wherever focus is. The frames are held here, so no frame can
// run between two key presses.
// - The fixture is a Popover with `modal="trap-focus"` and a Popover.Close: its popup holds a
//   `child` button and the close button, with a `before` and an `after` button outside it.

import { afterEach, describe, expect, it, vi } from "vitest";

import { createRenderer, screen, waitFor } from "../../shim/index.js";
import FfmPopover from "./fixtures/focus-popover.svelte";

/** Stops animation frames from running until the test ends. */
function holdFrames() {
	let handle = 0;
	vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
		handle += 1;
		return handle;
	});
	vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
}

describe("a popup that traps focus, with Tab pressed faster than a frame", () => {
	const { render } = createRenderer();

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function setup() {
		const { user } = await render(FfmPopover, {
			rootProps: { modal: "trap-focus" },
			withClose: true,
			before: true,
			after: true,
		});
		await user.click(screen.getByTestId("reference"));
		const child = screen.getByTestId("child");
		await waitFor(() => {
			expect(child).toHaveFocus();
		});
		return { user, child, close: screen.getByTestId("popup-close") };
	}

	it("wraps to the first element and goes on from there", async () => {
		const { user, child, close } = await setup();
		holdFrames();

		await user.keyboard("{Tab}");
		expect(close).toHaveFocus();
		// Past the last element: back to the first one, with no frame in between.
		await user.keyboard("{Tab}");
		expect(child).toHaveFocus();
		await user.keyboard("{Tab}");
		expect(close).toHaveFocus();
	});

	it("wraps to the last element with Shift+Tab and goes on from there", async () => {
		const { user, child, close } = await setup();
		holdFrames();

		await user.keyboard("{Shift>}{Tab}{/Shift}");
		expect(close).toHaveFocus();
		await user.keyboard("{Shift>}{Tab}{/Shift}");
		expect(child).toHaveFocus();
		await user.keyboard("{Shift>}{Tab}{/Shift}");
		expect(close).toHaveFocus();
	});
});
