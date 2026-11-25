// What the first frame leaves to the background: a Svelte block may render otherwise there, as
// `{#if background}` does, and the effects of the first mount run only there. Neither refuses
// hydration: a block that took another branch is made in place, whatever its tags, and what the
// effects change comes after the adoption.

import { describe, expect, it } from "@rstest/core";

import FrameBlocks from "../fixtures/threads/FrameBlocks.svelte";
import drawFrameBlocks from "../fixtures/threads/FrameBlocks.svelte?first-frame";
import FrameCall from "../fixtures/threads/FrameCall.svelte";
import drawFrameCall from "../fixtures/threads/FrameCall.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

function drawnBlocks(drawnTone: string, tone = drawnTone) {
	const log: unknown[] = [];
	const page = startSveltePage(FrameBlocks, {
		props: () => ({ tone, log }),
		firstFrame: { draw: drawFrameBlocks, props: { tone: drawnTone, log } },
	});
	return { page, log, drawn: page.engine.all() };
}

describe("{#if background}", () => {
	it("keeps its part out of the first frame", () => {
		const { page } = drawnBlocks("plain");
		expect(page.engine.texts()).toEqual(["top", "plain", ".", "drawn"]);
	});

	it("is made in place by the background, and everything around it adopted", async () => {
		const { page, drawn, log } = drawnBlocks("plain");
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["top", "background", "plain", ".", "mounted"]);
		const kept = page.engine.all().filter((element) => drawn.includes(element));
		expect(kept).toHaveLength(drawn.length);
		page.engine.dispatch(page.byClass("background-only"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["background-only"]);
	});
});

describe("a block that took another branch", () => {
	it("with other tags is made again in place", async () => {
		const { page } = drawnBlocks("plain", "loud");
		const plain = page.byClass("tone");
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["top", "background", "LOUD", "!", "mounted"]);
		expect(page.byClass("tone")).not.toBe(plain);
	});

	it("with the same tags is made again in place too", async () => {
		const { page } = drawnBlocks("plain", "loud");
		const badge = page.byClass("badge");
		await page.settle();
		expect(page.byClass("badge")).not.toBe(badge);
		expect(page.engine.state(page.byClass("badge")).classes).toBe("badge loud");
		expect(page.engine.text(page.byClass("badge"))).toBe("!");
		expect(page.errors).toEqual([]);
	});
});

describe("the first mount's effects", () => {
	it("change the adopted page after hydration, and refuse nothing", async () => {
		const { page } = drawnBlocks("plain");
		const bottom = page.byClass("bottom");
		await page.settle();
		expect(page.byClass("bottom")).toBe(bottom);
		expect(page.engine.state(bottom).dataset).toEqual({ mounted: true });
		expect(page.errors).toEqual([]);
	});

	it("run their calls on the adopted elements, and their removals take drawn elements off", async () => {
		const results: unknown[] = [];
		const page = startSveltePage(FrameCall, {
			props: () => ({ results }),
			firstFrame: { draw: drawFrameCall, props: { results } },
		});
		const scroller = page.byClass("scroller");
		expect(page.engine.texts()).toEqual(["drawn", "swipe", "footer"]);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.byClass("scroller")).toBe(scroller);
		expect(page.engine.texts()).toEqual(["mounted", "footer"]);
		expect(
			page.engine.invocations.map((call) => [call.element, call.method, call.params, call.code]),
		).toEqual([[scroller, "scrollTo", { offset: 40 }, 0]]);
		expect(results).toEqual([{ ok: null }]);
	});
});
