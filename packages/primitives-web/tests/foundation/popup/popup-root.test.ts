// `usePopupUnmount` unmounts a closed popup once the exit animations of the popup, or of the
// element `element` names instead (an inline combobox list waits for the dialog it is rendered in),
// finish.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRenderer, screen, waitFor } from "../../shim/index.js";
import PopupRootExit from "./fixtures/popup-root-exit.svelte";

function nextFrames(count: number) {
	return new Promise<void>((resolve) => {
		const step = (left: number) =>
			left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
		step(count);
	});
}

function animate(testId: string) {
	return screen
		.getByTestId(testId)
		.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
}

describe("connectPopupRoot", () => {
	const { render } = createRenderer();
	let disabled: boolean | undefined;

	beforeEach(() => {
		disabled = globalThis.SOHEDRA_ANIMATIONS_DISABLED;
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
	});

	afterEach(() => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = disabled;
	});

	it("waits for the popup's exit animations by default", async () => {
		const onUnmount = vi.fn();
		const { setProps } = await render(PopupRootExit, {
			awaiting: false,
			awaitOther: false,
			onUnmount,
		});
		const animation = animate("popup");

		await setProps({ awaiting: true });
		await nextFrames(2);
		expect(onUnmount).not.toHaveBeenCalled();

		await animation.finished;
		await waitFor(() => expect(onUnmount).toHaveBeenCalledTimes(1));
	});

	it("waits for the element getElement names instead of the popup", async () => {
		const onUnmount = vi.fn();
		const { setProps } = await render(PopupRootExit, {
			awaiting: false,
			awaitOther: true,
			onUnmount,
		});
		animate("popup");
		const animation = animate("other");

		await setProps({ awaiting: true });
		await nextFrames(2);
		expect(onUnmount).not.toHaveBeenCalled();

		await animation.finished;
		await waitFor(() => expect(onUnmount).toHaveBeenCalledTimes(1));
	});

	it("doesn't wait for the popup's animations when getElement names another element", async () => {
		const onUnmount = vi.fn();
		const { setProps } = await render(PopupRootExit, {
			awaiting: false,
			awaitOther: true,
			onUnmount,
		});
		const animation = animate("popup");

		await setProps({ awaiting: true });
		await waitFor(() => expect(onUnmount).toHaveBeenCalledTimes(1));
		expect(animation.playState).toBe("running");
	});
});
