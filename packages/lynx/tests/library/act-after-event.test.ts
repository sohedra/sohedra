// A test that does not wait for an event before `act` or `rerender`: the main thread still ends the
// event's task, and flushes what its handler changed, before the background runs the change.

import { expect, it } from "@rstest/core";
import { act, fireEvent, render } from "@sohedra/lynx/testing";

import TapFaded from "../fixtures/library/TapFaded.svelte";
import TapLater from "../fixtures/library/TapLater.svelte";

/**
 * What `run` left rejected with no handler: Node says so as it runs the reactions, before the
 * next macrotask.
 */
async function unhandledDuring(run: () => Promise<void>): Promise<unknown[]> {
	const unhandled: unknown[] = [];
	const onUnhandled = (reason: unknown) => void unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);
	try {
		await run();
		await new Promise((resolve) => setImmediate(resolve));
	} finally {
		process.off("unhandledRejection", onUnhandled);
	}
	return unhandled;
}

it("ends a main-thread handler's task when act follows the event with no await", async () => {
	const { container } = await render(TapFaded);
	const box = container.querySelector<HTMLElement>(".box")!;
	const unhandled = await unhandledDuring(async () => {
		void fireEvent.tap(box);
		await act();
	});
	expect(unhandled).toEqual([]);
	expect(box.style.opacity).toBe("0.5");
});

it("ends a main-thread handler's task when rerender follows the event with no await", async () => {
	const { container, rerender } = await render(TapFaded);
	const box = container.querySelector<HTMLElement>(".box")!;
	const unhandled = await unhandledDuring(async () => {
		void fireEvent.tap(box);
		await rerender({ step: 2 });
	});
	expect(unhandled).toEqual([]);
	expect(box.style.opacity).toBe("0.5");
	expect(box.dataset["step"]).toBe("2");
});

it("ends the task with what the handler chained when act runs from a macrotask's own code", async () => {
	const { container } = await render(TapLater);
	const box = container.querySelector<HTMLElement>(".box")!;
	const unhandled = await unhandledDuring(
		() =>
			new Promise<void>((resolve, reject) => {
				setImmediate(() => {
					void fireEvent.tap(box);
					act().then(() => resolve(), reject);
				});
			}),
	);
	expect(unhandled).toEqual([]);
	expect(box.style.opacity).toBe("0.5");
});
