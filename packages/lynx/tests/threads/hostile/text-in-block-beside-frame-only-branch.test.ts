// A text inside a block of a branch only the background renders, beside the `{:else}` that the
// first frame drew with more elements (`{#if background}{#if prefix}A{/if}B<text/>{:else}…{/if}`,
// a skeleton in `{:else}`): the elements of the two branches differ, so the texts are made again in
// place, and each goes where the background has it.

import { describe, expect, it } from "@rstest/core";

import FrameTextInBlock from "../../fixtures/threads/FrameTextInBlock.svelte";
import drawFrameTextInBlock from "../../fixtures/threads/FrameTextInBlock.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

describe("a text in a block of a background-only branch", () => {
	it("shows in its place on a page with no first frame", async () => {
		const page = startSveltePage(FrameTextInBlock);
		await page.settle();
		expect(page.engine.text(page.byClass("t"))).toBe("ABi");
	});

	it("is made in its place by hydration, with no mismatch", async () => {
		const page = startSveltePage(FrameTextInBlock, { firstFrame: { draw: drawFrameTextInBlock } });
		expect(page.engine.text(page.byClass("t"))).toBe("BffA");
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.text(page.byClass("t"))).toBe("ABi");
	});
});
