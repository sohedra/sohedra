// Rows of an `{#each}` the background has more or fewer of than the first frame, beside an `{#if}`:
// a header or a footer above or below a list drawn from older page data. Nothing reports an
// `{#each}`'s rows, so the parent's children do not line up; a block among them explains it, and
// they are made again in place. With no block in the parent, it is a mismatch, and the page is
// written again.

import { describe, expect, it } from "@rstest/core";

import AfterBlock from "../fixtures/threads/rows/AfterBlock.svelte";
import drawAfterBlock from "../fixtures/threads/rows/AfterBlock.svelte?first-frame";
import BeforeBlock from "../fixtures/threads/rows/BeforeBlock.svelte";
import drawBeforeBlock from "../fixtures/threads/rows/BeforeBlock.svelte?first-frame";
import BetweenBlocks from "../fixtures/threads/rows/BetweenBlocks.svelte";
import drawBetweenBlocks from "../fixtures/threads/rows/BetweenBlocks.svelte?first-frame";
import NoBlock from "../fixtures/threads/rows/NoBlock.svelte";
import drawNoBlock from "../fixtures/threads/rows/NoBlock.svelte?first-frame";
import type { FirstFrameCopy } from "./svelte-page.ts";
import { startSveltePage } from "./svelte-page.ts";

async function hydrated(
	App: Parameters<typeof startSveltePage>[0],
	draw: FirstFrameCopy,
	{ drawn, built }: { drawn: string[]; built: string[] },
) {
	const page = startSveltePage(App, {
		props: () => ({ rows: built, log: [] }),
		firstFrame: { draw, props: { rows: drawn, log: [] } },
	});
	await page.settle();
	const rewrites = page.messages.filter((message) => message.t === "rewrite");
	return { page, rewrites };
}

const counts = [
	[["a"], ["a", "b"]],
	[["a", "b"], ["a"]],
	[[], ["a"]],
];

describe("rows the background has more or fewer of", () => {
	it.each([
		["between two {#if}s", BetweenBlocks, drawBetweenBlocks],
		["after an {#if}", AfterBlock, drawAfterBlock],
		["before an {#if}", BeforeBlock, drawBeforeBlock],
	] as const)("%s, are made again in place", async (_, App, draw) => {
		for (const [drawn, built] of counts) {
			const { page, rewrites } = await hydrated(App, draw, { drawn: drawn!, built: built! });
			expect(page.errors).toEqual([]);
			expect(rewrites).toEqual([]);
			expect(
				page.engine.all().filter((element) => page.engine.state(element).classes === "s-row"),
			).toHaveLength(built!.length);
		}
	});

	it("in a parent with no block, refuse hydration", async () => {
		const { page, rewrites } = await hydrated(NoBlock, drawNoBlock, {
			drawn: ["a"],
			built: ["a", "b"],
		});
		expect(page.errors).toEqual([expect.objectContaining({ code: "hydration_mismatch" })]);
		expect(rewrites).toHaveLength(1);
	});
});
