// waitForAnimations through a closing Popover (fixtures/presence-popovers.svelte), whose Root
// unmounts the popup once the popup's animations finish: which animations it waits for, and how
// the completions of two popups closing together commit.
// - The popup of an open Popover has its `getAnimations` stubbed once it has opened, then closed:
//   `onFinished` is `onOpenChangeComplete(false)`, and the popup leaves the document with it.
// - Two Popovers closed together, the first's completion opening the second: `onSecondUnmount` is
//   the second Popover's `onOpenChangeComplete(false)`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

import { nextTask } from "../../kit/kit-frames.js";
import PresencePopovers from "./fixtures/presence-popovers.svelte";

/** A stand-in animation whose `finished` the test settles with `finish` or `cancel`. */
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

describe("waitForAnimations", () => {
	beforeEach(() => {
		// The reset in setup-reset.ts turns animations off again after each test.
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = false;
	});

	/** An open Popover whose popup's `getAnimations` is stubbed, then closed. */
	async function setup(getAnimations: () => Animation[]) {
		const onFinished = vi.fn();
		const onOpenChangeComplete = vi.fn((open: boolean) => {
			if (!open) {
				onFinished();
			}
		});
		const screen = await render(PresencePopovers, { onFirstComplete: onOpenChangeComplete });
		await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(true));
		screen.getByTestId("popup-1").element().getAnimations = getAnimations;
		await screen.rerender({ firstOpen: false });
		return { onFinished };
	}

	it.each(["finish", "cancel"] as const)(
		"ignores infinite animations when a finite animation completes via %s",
		async (completion) => {
			const finite = createAnimation();
			const infinite = createAnimation(Infinity);
			let animations = [finite.animation, infinite.animation];
			const getAnimations = vi.fn(() => animations);

			const { onFinished } = await setup(getAnimations);
			await vi.waitFor(() => expect(getAnimations).toHaveBeenCalled());
			expect(onFinished).not.toHaveBeenCalled();

			animations = [infinite.animation];
			finite[completion]();

			await vi.waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
		},
	);

	it.each([
		["iteration count", Infinity, 1],
		["duration", 1, Infinity],
	] as const)(
		"finishes when the element only has an animation with an infinite %s",
		async (_timing, iterations, duration) => {
			const infinite = createAnimation(iterations, duration);

			const { onFinished } = await setup(() => [infinite.animation]);
			await vi.waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
		},
	);

	it("waits for a replacement animation after an animation is canceled", async () => {
		const initialAnimation = createAnimation();
		const replacementAnimation = createAnimation();
		const infiniteAnimation = createAnimation(Infinity);
		let animations: Animation[] = [initialAnimation.animation, infiniteAnimation.animation];
		let getAnimationsCallCount = 0;

		const { onFinished } = await setup(() => {
			getAnimationsCallCount += 1;
			return animations;
		});

		await vi.waitFor(() => {
			expect(getAnimationsCallCount).toBeGreaterThan(0);
		});

		animations = [replacementAnimation.animation, infiniteAnimation.animation];
		initialAnimation.cancel();
		// Every reaction to the cancel runs in microtasks, all done before the next task.
		await nextTask();

		expect(onFinished).not.toHaveBeenCalled();

		animations = [];
		replacementAnimation.finish();

		await vi.waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
	});

	it("finishes when a canceled animation has no replacement", async () => {
		const initialAnimation = createAnimation();
		let animations: Animation[] = [initialAnimation.animation];
		let getAnimationsCallCount = 0;

		const { onFinished } = await setup(() => {
			getAnimationsCallCount += 1;
			return animations;
		});

		await vi.waitFor(() => {
			expect(getAnimationsCallCount).toBeGreaterThan(0);
		});

		animations = [];
		initialAnimation.cancel();

		await vi.waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
	});

	it("commits each callback separately so later callbacks observe earlier updates", async () => {
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

		const screen = await render(PresencePopovers, {
			second: true,
			reopenSecond: true,
			onFirstComplete,
			onSecondComplete,
		});
		await vi.waitFor(() => expect(onFirstComplete).toHaveBeenCalledWith(true));
		await vi.waitFor(() => expect(onSecondComplete).toHaveBeenCalledWith(true));
		screen.getByTestId("popup-1").element().getAnimations = firstGetAnimations;
		screen.getByTestId("popup-2").element().getAnimations = secondGetAnimations;

		await screen.rerender({ firstOpen: false, secondOpen: false });

		await vi.waitFor(() => {
			expect(firstGetAnimations).toHaveBeenCalled();
		});
		await vi.waitFor(() => {
			expect(secondGetAnimations).toHaveBeenCalled();
		});

		// Both popups are closing. The first popup's close completion reopens the second,
		// which must prevent the second popup's queued completion from unmounting it.
		first.finish();
		second.finish();

		await vi.waitFor(() => expect(onFirstComplete).toHaveBeenCalledWith(false));
		// The second's queued completion runs in microtasks, all done before the next task.
		await nextTask();
		expect(onSecondUnmount).not.toHaveBeenCalled();
	});
});
