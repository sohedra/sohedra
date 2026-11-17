// A reload while the main thread waits for the page written again after a refused hydration: the
// first frame stays on the screen until the reloaded page's patch replaces it, with no empty flush.

import { expect, it } from "@rstest/core";

import { nextMacrotask } from "../../../src/testing/globals.ts";
import FrameCounter from "../../fixtures/threads/FrameCounter.svelte";
import { startSveltePage } from "../svelte-page.ts";

it("keeps the first frame on the screen until the reloaded page's patch", async () => {
	const page = startSveltePage(FrameCounter, {
		firstFrame: () => `<text class="root">Taps: 0 (even)</text>`,
	});
	// The first patch reaches the main thread, which refuses it and asks for the page again.
	await new Promise<void>((resolve) => nextMacrotask(resolve));
	expect(page.engine.texts()).toEqual(["Taps: 0 (even)"]);
	page.reload();
	expect(page.engine.texts()).toEqual(["Taps: 0 (even)"]);
	await page.settle();
	expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
});
