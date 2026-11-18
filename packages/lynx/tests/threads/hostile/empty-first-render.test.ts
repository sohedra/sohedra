// A page whose background renders nothing at first (`{#if background}{:else}…{/if}`, then
// `{#if shown}` with `shown` false): its first patch has no items, and is sent all the same. The
// main thread hydrates the first frame with it, so what only the frame drew leaves the screen, the
// frame stops listening for early taps, and the page's later patches are applied as patches.

import { expect, it } from "@rstest/core";

import FrameLate from "../../fixtures/threads/FrameLate.svelte";
import drawFrameLate from "../../fixtures/threads/FrameLate.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

it("hydrates the first frame with an empty first patch", async () => {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(FrameLate, {
		props: () => ({ handles }),
		firstFrame: { draw: drawFrameLate },
	});
	expect(page.engine.texts()).toEqual(["Drawn"]);
	await page.settle();
	expect(page.patches).toHaveLength(1);
	expect(page.engine.texts()).toEqual([]);
	expect(page.engine.listenerCount()).toBe(0);
	page.asBackground(() => ((handles["late"] as { shown: boolean }).shown = true));
	await page.settle();
	expect(page.engine.texts()).toEqual(["Late"]);
	expect(page.errors).toEqual([]);
});
