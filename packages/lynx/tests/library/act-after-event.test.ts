// A test that does not wait for an event before `act` or `rerender`: the main thread still ends the
// event's task, and flushes what its handler changed, before the background runs the change.

import { expect, it } from "@rstest/core";
import { act, fireEvent, render } from "@sohedra/lynx/testing";

import TapFaded from "../fixtures/library/TapFaded.svelte";

/** What `run` left rejected with no handler, once the process had a moment to say so. */
async function unhandledDuring(run: () => Promise<void>): Promise<unknown[]> {
	const unhandled: unknown[] = [];
	const onUnhandled = (reason: unknown) => void unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);
	try {
		await run();
		await new Promise((resolve) => setTimeout(resolve, 10));
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
