// Waiting on the browser's and Svelte's own boundaries: the next frame, the next task, and Svelte's
// updates after a microtask; and holding frames back where the order of a frame is the case.
import { flushSync } from "svelte";
import { onTestFinished, vi } from "vitest";

/**
 * Resolves in the next animation frame: past work a part schedules a frame ahead, such as a focus
 * move or a check that runs once layout is known. Wait for a state instead wherever one shows it.
 */
export function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Resolves in the next task: past work a part schedules a task ahead, such as a control restoring
 * its default after a form reset. Wait for a state instead wherever one shows the result.
 */
export function nextTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Applies Svelte's pending updates after a microtask, as `tick()` does outside async mode. */
export async function settle(): Promise<void> {
	await Promise.resolve();
	flushSync();
}

/**
 * Holds the page's animation frames back until the test ends: no frame runs between two inputs.
 * `run()` runs the frames requested so far, at a point the test chooses.
 */
export function holdFrames(): { run(): void } {
	const pending = new Map<number, FrameRequestCallback>();
	let handle = 0;
	const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
		handle += 1;
		pending.set(handle, callback);
		return handle;
	});
	const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
		pending.delete(id);
	});
	onTestFinished(() => {
		request.mockRestore();
		cancel.mockRestore();
	});
	return {
		run() {
			const callbacks = [...pending.values()];
			pending.clear();
			callbacks.forEach((callback) => callback(performance.now()));
		},
	};
}
