// Cases through a closing Popover (fixtures/presence-popovers.svelte), whose Root unmounts the
// popup once the popup's animations finish (`waitForAnimations`,
// src/foundation/presence/presence-animations.svelte.ts).
// Notes:
// - The popup of an open Popover has its `getAnimations` stubbed once it has opened, then closed:
//   `onFinished` is `onOpenChangeComplete(false)`, and the popup leaves the document with it.
// - "commits each callback separately by default so later callbacks observe earlier updates": two
//   Popovers closed together, the first's completion opening the second; `onSecondUnmount` is the
//   second Popover's `onOpenChangeComplete(false)`.
// - `flushMicrotasks` is an empty `act`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act, createRenderer, screen, waitFor } from "../../shim/index.js";
import PresencePopovers from "./fixtures/presence-popovers.svelte";

function createAnimation(iterations = 1, duration = 1) {
	let resolveFinished!: () => void;
	let rejectFinished!: () => void;

	const finished = new Promise<void>((resolve, reject) => {
		resolveFinished = resolve;
		rejectFinished = reject;
	});
	// A rejection nobody awaits yet must not fail the run.
	finished.catch(() => {});

	return {
		animation: {
			finished,
			effect: { getTiming: () => ({ duration, iterations }) },
			pending: false,
			playState: "running",
		} as unknown as Animation,
		finish: resolveFinished,
		cancel: rejectFinished,
	};
}

const flushMicrotasks = () => act(async () => {});

describe("useAnimationsFinished", () => {
	const { render } = createRenderer();
	let animationsDisabled: boolean | undefined;

	beforeEach(() => {
		animationsDisabled = globalThis.SOHEDRA_ANIMATIONS_DISABLED;
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
	});

	afterEach(() => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = animationsDisabled;
	});

	// An open Popover whose popup's `getAnimations` is stubbed, then closed.
	async function renderTest(getAnimations: () => Animation[]) {
		const onFinished = vi.fn();
		const onOpenChangeComplete = vi.fn((open: boolean) => {
			if (!open) {
				onFinished();
			}
		});
		const { setProps } = await render(PresencePopovers, {
			onFirstComplete: onOpenChangeComplete,
		});
		await waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true));
		const popup = screen.getByTestId("popup-1");
		popup.getAnimations = getAnimations;
		await setProps({ firstOpen: false });
		return { onFinished, popup };
	}

	it.each(["finish", "cancel"] as const)(
		"ignores infinite animations when a finite animation completes via %s",
		async (completion) => {
			const finite = createAnimation();
			const infinite = createAnimation(Infinity);
			let animations = [finite.animation, infinite.animation];
			const getAnimations = vi.fn(() => animations);

			const { onFinished } = await renderTest(getAnimations);
			await waitFor(() => expect(getAnimations).toHaveBeenCalled());
			expect(onFinished).not.toHaveBeenCalled();

			animations = [infinite.animation];
			await act(async () => {
				finite[completion]();
				await flushMicrotasks();
			});

			expect(onFinished).toHaveBeenCalledTimes(1);
		},
	);

	it.each([
		["iteration count", Infinity, 1],
		["duration", 1, Infinity],
	] as const)(
		"finishes when the element only has an animation with an infinite %s",
		async (_timing, iterations, duration) => {
			const infinite = createAnimation(iterations, duration);

			const { onFinished } = await renderTest(() => [infinite.animation]);
			await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
		},
	);

	it("waits for a replacement animation after an animation is canceled", async () => {
		const initialAnimation = createAnimation();
		const replacementAnimation = createAnimation();
		const infiniteAnimation = createAnimation(Infinity);
		let animations: Animation[] = [initialAnimation.animation, infiniteAnimation.animation];
		let getAnimationsCallCount = 0;

		const { onFinished } = await renderTest(() => {
			getAnimationsCallCount += 1;
			return animations;
		});

		await waitFor(() => {
			expect(getAnimationsCallCount).toBeGreaterThan(0);
		});

		animations = [replacementAnimation.animation, infiniteAnimation.animation];

		await act(async () => {
			initialAnimation.cancel();
			await flushMicrotasks();
		});

		expect(onFinished).not.toHaveBeenCalled();

		animations = [];

		await act(async () => {
			replacementAnimation.finish();
			await flushMicrotasks();
		});

		expect(onFinished).toHaveBeenCalledTimes(1);
	});

	it("finishes when a canceled animation has no replacement", async () => {
		const initialAnimation = createAnimation();
		let animations: Animation[] = [initialAnimation.animation];
		let getAnimationsCallCount = 0;

		const { onFinished } = await renderTest(() => {
			getAnimationsCallCount += 1;
			return animations;
		});

		await waitFor(() => {
			expect(getAnimationsCallCount).toBeGreaterThan(0);
		});

		animations = [];

		await act(async () => {
			initialAnimation.cancel();
			await flushMicrotasks();
		});

		expect(onFinished).toHaveBeenCalledTimes(1);
	});

	it("commits each callback separately by default so later callbacks observe earlier updates", async () => {
		const first = createAnimation();
		const second = createAnimation();
		const firstGetAnimations = vi.fn(() => [first.animation]);
		const secondGetAnimations = vi.fn(() => [second.animation]);
		const onFirstComplete = vi.fn();
		const onSecondComplete = vi.fn();
		const onSecondUnmount = vi.fn();
		onSecondComplete.mockImplementation((open: boolean) => {
			if (!open) {
				onSecondUnmount();
			}
		});

		const { setProps } = await render(PresencePopovers, {
			second: true,
			reopenSecond: true,
			onFirstComplete,
			onSecondComplete,
		});
		await waitFor(() => expect(onFirstComplete).toHaveBeenCalledWith(true));
		await waitFor(() => expect(onSecondComplete).toHaveBeenCalledWith(true));
		screen.getByTestId("popup-1").getAnimations = firstGetAnimations;
		screen.getByTestId("popup-2").getAnimations = secondGetAnimations;

		await setProps({ firstOpen: false, secondOpen: false });

		await waitFor(() => {
			expect(firstGetAnimations).toHaveBeenCalled();
		});
		await waitFor(() => {
			expect(secondGetAnimations).toHaveBeenCalled();
		});

		// Both popups are closing. The first popup's close completion reopens the second,
		// which must prevent the second popup's queued completion from unmounting it.
		await act(async () => {
			first.finish();
			second.finish();
			await flushMicrotasks();
		});

		expect(onFirstComplete).toHaveBeenCalledWith(false);
		expect(onSecondUnmount).not.toHaveBeenCalled();
	});
});
