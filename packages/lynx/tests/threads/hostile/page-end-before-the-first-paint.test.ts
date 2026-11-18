// The page's life ends while the background's first patch waits for the first paint: the patch is
// dropped, and the paint that comes after changes nothing.

import { describe, expect, it } from "@rstest/core";

import FrameCounter from "../../fixtures/threads/FrameCounter.svelte";
import drawFrameCounter from "../../fixtures/threads/FrameCounter.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

/** The counter page: its first frame says `drawn`, and the background's page `patched`. */
function counter() {
	return startSveltePage(FrameCounter, {
		props: () => ({ parity: "patched" }),
		firstFrame: { draw: drawFrameCounter, props: { parity: "drawn" } },
	});
}

describe("the page's end before the first paint", () => {
	it("drops the waiting patch", async () => {
		const page = counter();
		const frames = page.engine.holdFrames();
		await page.settle();
		page.destroy();
		const flushes = page.engine.flushes.length;
		frames();
		await page.settle();
		expect(page.engine.flushes.length).toBe(flushes);
		expect(page.errors).toEqual([]);
	});
});
