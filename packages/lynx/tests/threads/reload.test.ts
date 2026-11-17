// A reload starts the app over with the new data merged in. The old app is torn down
// synchronously and the new one renders in the same task: the main thread gets one patch, of the
// new page, and swaps the pages in one flush. What either thread sent for the old page is dropped.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../src/testing/globals.ts";
import { encodeToBackground, OpCode, PATCH_METHOD, TO_BACKGROUND } from "../../src/wire/index.ts";
import Counter from "../fixtures/threads/Counter.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function counter() {
	const page = startSveltePage(Counter, { initData: { from: "native" } });
	await page.settle();
	page.engine.dispatch(page.byClass("button"), { type: "tap" });
	await page.settle();
	return page;
}

describe("a reload", () => {
	it("sends one patch, of the new page, with the new app from its start", async () => {
		const page = await counter();
		const before = page.patches.length;
		const flushes = page.engine.flushes.length;
		page.reload({ reloaded: true });
		await page.settle();
		expect(page.patches.slice(before).map((patch) => patch.page)).toEqual([1]);
		expect(page.lynx.background.__initData).toEqual({ from: "native", reloaded: true });
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
		// The main thread's own flush for the reload, then one for the new page's patch.
		expect(page.engine.flushes.length).toBe(flushes + 2);
		expect(page.errors).toEqual([]);
	});

	it("leaves only the new app's listeners, which work", async () => {
		const page = await counter();
		page.reload();
		await page.settle();
		expect(page.engine.listenerCount()).toBe(1);
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
	});

	it("keeps the old page shown until the new page's patch replaces it", async () => {
		const page = await counter();
		page.reload();
		// The main thread has reloaded; the background has not yet.
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(page.engine.listenerCount()).toBe(0);
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (even)");
	});
});

describe("a message of another page", () => {
	it("is dropped by the main thread: a patch the background sent before the reload", async () => {
		const page = await counter();
		const stale = page.patches[0]!;
		page.reload();
		await page.settle();
		const flushes = page.engine.flushes.length;
		const patch = readGlobal(PATCH_METHOD) as (params: { data: string }) => void;
		page.asMainThread(() => patch({ data: JSON.stringify(stale) }));
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
		expect(page.engine.flushes.length).toBe(flushes);
		expect(page.errors).toEqual([]);
	});

	it("is dropped by the background: an event the old page's element sent", async () => {
		const page = await counter();
		page.reload();
		await page.settle();
		// The new page's tap, as its patch binds it.
		const ops = page.patches.at(-1)!.items.flatMap((item) => (item[0] === "ops" ? item[1] : []));
		const handler = ops.find((op) => op[0] === OpCode.SetEvent)![4] as number;
		const stale = encodeToBackground({ t: "event", handler, event: { type: "tap" } }, 0);
		page.lynx.mainThread.getJSContext().dispatchEvent(stale);
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (even)");
		const current = encodeToBackground({ t: "event", handler, event: { type: "tap" } }, 1);
		page.lynx.mainThread.getJSContext().dispatchEvent(current);
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(stale.type).toBe(TO_BACKGROUND.events);
	});
});
