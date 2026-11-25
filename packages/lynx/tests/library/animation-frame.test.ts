// `requestAnimationFrame` around a rendered page: `svelte/motion` calls the global one, and so may a
// test. The background's is the test's own, which decides when a frame comes, and each frame runs
// as the background, as on a device.

import { afterEach, expect, it } from "@rstest/core";
import { act, cleanup, fireEvent, render } from "@sohedra/lynx/testing";

import Counter from "../fixtures/library/Counter.svelte";
import Framed from "../fixtures/library/Framed.svelte";

const g = globalThis as { requestAnimationFrame?: unknown };
const before = g.requestAnimationFrame;

afterEach(() => {
	g.requestAnimationFrame = before;
});

it("gives the background the test's requestAnimationFrame, and puts it back when the page ends", async () => {
	const frames: unknown[] = [];
	const own = (callback: unknown) => frames.push(callback);
	g.requestAnimationFrame = own;
	await render(Counter);
	(g.requestAnimationFrame as typeof own)(() => {});
	expect(frames).toHaveLength(1);
	cleanup();
	expect(g.requestAnimationFrame).toBe(own);
});

it("runs a frame the test runs as the background, after the main thread ran last", async () => {
	const frames: ((time: number) => void)[] = [];
	g.requestAnimationFrame = (callback: (time: number) => void) => frames.push(callback);
	const { container } = await render(Framed);
	const next = container.querySelector(".next")!;
	await fireEvent.tap(next);
	expect(frames).toHaveLength(1);
	// The main thread hears a second tap at once, so it ran last when the test runs the frame.
	const tapped = fireEvent.tap(next);
	frames.shift()!(performance.now());
	await tapped;
	await act();
	expect(container.querySelector(".frames")!.textContent).toBe("1");
});
