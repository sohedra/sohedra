// `requestAnimationFrame` around a rendered page: `svelte/motion` calls the global one, and so may a
// test. The page's runtime leaves it alone.

import { afterEach, expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";

import Counter from "../fixtures/library/Counter.svelte";

const g = globalThis as { requestAnimationFrame?: unknown };
const before = g.requestAnimationFrame;

afterEach(() => {
	g.requestAnimationFrame = before;
});

it("leaves the test's requestAnimationFrame in place while a page is rendered", async () => {
	const frames: unknown[] = [];
	const own = (callback: unknown) => frames.push(callback);
	g.requestAnimationFrame = own;
	await render(Counter);
	expect(g.requestAnimationFrame).toBe(own);
	(g.requestAnimationFrame as typeof own)(() => {});
	expect(frames).toHaveLength(1);
});
