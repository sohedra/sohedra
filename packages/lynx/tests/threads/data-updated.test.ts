// New data for the page reaches the host's `onDataUpdated`: Lynx calls it for a flush with
// `triggerDataUpdated`. The background's page flags the patch that shows the data; before the
// background's page is shown, the main thread flags its own flush of the update.

import { describe, expect, it } from "@rstest/core";

import Counter from "../fixtures/threads/Counter.svelte";
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

	it("on the main thread's path: an update before the background's page is shown", async () => {
		const page = startSveltePage(Counter);
		// The background's first patch is on its way; the main thread updates its own page.
		page.updateData({ theme: "dark" });
		expect(flagged(page.engine.flushes.at(-1))).toBe(true);
		await page.settle();
		page.engine.lifecycle.update({ theme: "light" });
		expect(flagged(page.engine.flushes.at(-1))).toBe(false);
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
