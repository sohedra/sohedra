// A reload while the background's first patch waits for the first paint: the old page's patch is
// dropped, and the new page's patch shows the page, which answers taps.

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

describe("a reload before the first paint", () => {
	it("drops the old page's waiting patch, and shows the new page's", async () => {
		const page = counter();
		const frames = page.engine.holdFrames();
		await page.settle();
		page.reload();
		frames();
		await page.settle();
		expect(page.patches).toHaveLength(2);
		expect(page.engine.texts()).toEqual(["Taps: 0 (patched)", "Tap me"]);
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(page.errors).toEqual([]);
	});
});
