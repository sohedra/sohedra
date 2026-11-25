// Hydration on a plain page: the main thread draws the first frame from the page's data when the
// engine renders it, and the background's first patch adopts the drawn elements (the same Lynx
// elements, only what differs written) instead of making them. A tap made before is replayed
// through the background's handler.

import { describe, expect, it } from "@rstest/core";

import FrameCounter from "../fixtures/threads/FrameCounter.svelte";
import drawFrameCounter from "../fixtures/threads/FrameCounter.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

/** The page, before the background's first patch reaches the main thread. */
function drawnCounter() {
	const page = startSveltePage(FrameCounter, {
		initData: { parity: "drawn" },
		props: (data) => ({ parity: data["parity"] }),
		firstFrame: { draw: drawFrameCounter, props: { parity: "drawn" } },
	});
	const drawn = page.engine.all();
	const flushes = page.engine.flushes.length;
	return { page, drawn, flushes };
}

describe("hydration", () => {
	it("draws the first frame when the engine renders the page, from the page's data", () => {
		const { page } = drawnCounter();
		expect(page.engine.texts()).toEqual(["Taps: 0 (drawn)", "Tap me"]);
		expect(page.errors).toEqual([]);
	});

	it("adopts every drawn element, writes nothing that is the same, and flushes once", async () => {
		const { page, drawn, flushes } = drawnCounter();
		await page.settle();
		expect(page.engine.all()).toEqual(drawn);
		expect(page.engine.flushes.length).toBe(flushes + 1);
		expect(page.engine.texts()).toEqual(["Taps: 0 (drawn)", "Tap me"]);
		expect(page.errors).toEqual([]);
	});

	it("runs taps through the adopted elements, and the first frame's listeners are gone", async () => {
		const { page, drawn } = drawnCounter();
		await page.settle();
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(page.engine.all()).toEqual(drawn);
		expect(page.engine.listenerCount()).toBe(1);
	});

	it("replays a tap the first frame heard, once, through the handler it bubbles to", async () => {
		const { page } = drawnCounter();
		page.engine.dispatch(page.byClass("label"), { type: "tap" });
		expect(page.engine.texts()[0]).toBe("Taps: 0 (drawn)");
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(page.errors).toEqual([]);
	});

	it("writes a text that differs over the drawn one, and keeps the element", async () => {
		const page = startSveltePage(FrameCounter, {
			initData: { parity: "drawn" },
			props: (data) => ({ parity: data["parity"] }),
			firstFrame: (data) =>
				`<view class="root" style="padding: 24px;"><text class="count">Taps: 0 (${String(data["parity"])}, as the server said)</text>` +
				`<view class="button"><text class="label">Tap me</text></view></view>`,
		});
		const drawn = page.engine.all();
		await page.settle();
		expect(page.engine.all()).toEqual(drawn);
		expect(page.engine.texts()).toEqual(["Taps: 0 (drawn)", "Tap me"]);
		expect(page.errors).toEqual([]);
	});

	it("draws nothing when the app's main-thread script records no first frame", async () => {
		const page = startSveltePage(FrameCounter);
		expect(page.engine.all()).toHaveLength(1);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
	});

	it("draws nothing, and the background makes the page, when the page has no first frame", async () => {
		const page = startSveltePage(FrameCounter, { firstFrame: () => null });
		expect(page.engine.all()).toHaveLength(1);
		await page.settle();
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
		expect(page.errors).toEqual([]);
	});
});
