// usePopupUnmount: a closed popup unmounts once the exit animations of the popup, or of the
// element it names instead (an inline combobox list waits for the dialog it is rendered in),
// finish. The popup store is a stand-in (fixtures/popup-unmount-exit.svelte), and animations are on.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

import { nextFrame } from "../../kit/kit-frames.js";
import PopupUnmountExit from "./fixtures/popup-unmount-exit.svelte";

describe("usePopupUnmount", () => {
	beforeEach(() => {
		// The reset in setup-reset.ts turns animations off again after each test.
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
	});

	async function setup(awaitOther: boolean) {
		const onUnmount = vi.fn();
		const screen = await render(PopupUnmountExit, { awaiting: false, awaitOther, onUnmount });
		/** Starts a 200ms fade-out on the element with `testId`. */
		const animate = (testId: string) =>
			screen
				.getByTestId(testId)
				.element()
				.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
		return { screen, onUnmount, animate };
	}

	it("waits for the popup's exit animations by default", async () => {
		const { screen, onUnmount, animate } = await setup(false);
		const animation = animate("popup");

		await screen.rerender({ awaiting: true });
		await nextFrame();
		await nextFrame();
		expect(onUnmount).not.toHaveBeenCalled();

		await animation.finished;
		await vi.waitFor(() => expect(onUnmount).toHaveBeenCalledTimes(1));
	});

	it("waits for the element getElement names instead of the popup", async () => {
		const { screen, onUnmount, animate } = await setup(true);
		animate("popup");
		const animation = animate("other");

		await screen.rerender({ awaiting: true });
		await nextFrame();
		await nextFrame();
		expect(onUnmount).not.toHaveBeenCalled();

		await animation.finished;
		await vi.waitFor(() => expect(onUnmount).toHaveBeenCalledTimes(1));
	});

	it("doesn't wait for the popup's animations when getElement names another element", async () => {
		const { screen, onUnmount, animate } = await setup(true);
		const animation = animate("popup");

		await screen.rerender({ awaiting: true });
		await vi.waitFor(() => expect(onUnmount).toHaveBeenCalledTimes(1));
		expect(animation.playState).toBe("running");
	});
});
