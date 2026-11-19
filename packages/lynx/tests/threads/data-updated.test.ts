// New data for the page reaches the host's `onDataUpdated`: Lynx calls it for a flush with
// `triggerDataUpdated`. The background's page flags the patch that shows the data, and only that
// one: the host hears one event for each change, also while the first patch is on its way, and for
// data that came before the page started.

import { describe, expect, it } from "@rstest/core";

import { mountPage } from "../../src/background/index.ts";
import { startMainThread } from "../../src/main-thread/index.ts";
import { startTestPage } from "../../src/testing/index.ts";
import Counter from "../fixtures/threads/Counter.svelte";
import FrameCounter from "../fixtures/threads/FrameCounter.svelte";
import drawFrameCounter from "../fixtures/threads/FrameCounter.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

const flagged = (options: unknown): boolean =>
	(options as { triggerDataUpdated?: unknown } | undefined)?.triggerDataUpdated === true;

describe("new data for the page", () => {
	it("on the background's path: the patch after updateCardData is flushed with triggerDataUpdated", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const flushes = page.engine.flushes.length;
		page.updateData({ theme: "dark" });
		await page.settle();
		const after = page.engine.flushes.slice(flushes);
		// The main thread's flush of the update, then the background's patch.
		expect(after.map(flagged)).toEqual([false, true]);
		expect(page.patches.at(-1)).toMatchObject({ items: [], dataUpdated: true });
	});

	it("fires once for an update while the background's first patch is on its way", async () => {
		const page = startSveltePage(Counter);
		// The background's first patch is on its way: the page shows nothing of the data yet.
		const flushes = page.engine.flushes.length;
		page.updateData({ theme: "dark" });
		await page.settle();
		// The main thread's flush of the update, the first patch's, then the patch for the data.
		expect(page.engine.flushes.slice(flushes).map(flagged)).toEqual([false, false, true]);
		page.engine.lifecycle.update({ theme: "light" });
		expect(flagged(page.engine.flushes.at(-1))).toBe(false);
	});

	it("fires once for an update while the first frame waits for hydration", async () => {
		const page = startSveltePage(FrameCounter, { firstFrame: { draw: drawFrameCounter } });
		const flushes = page.engine.flushes.length;
		page.updateData({ theme: "dark" });
		await page.settle();
		expect(page.engine.flushes.slice(flushes).filter(flagged)).toHaveLength(1);
		expect(page.errors).toEqual([]);
	});

	it("is not flagged for the data the page opened with, which is no update", async () => {
		const page = startTestPage({
			initData: { theme: "dark" },
			mainThread: () => startMainThread(),
			background: () => mountPage(Counter),
		});
		await page.settle();
		expect(page.engine.flushes.filter(flagged)).toHaveLength(0);
		expect(page.lynx.background.__initData).toEqual({ theme: "dark" });
	});

	it("is not flagged for a patch that shows no new data", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		expect(page.engine.flushes.some(flagged)).toBe(false);
		expect(page.patches.every((patch) => patch.dataUpdated === undefined)).toBe(true);
	});
});
