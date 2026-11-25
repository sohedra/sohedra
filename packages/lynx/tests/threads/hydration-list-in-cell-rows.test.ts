// A list in a cell whose rows differ between the first frame and the background: its rows are made
// again in place, Lynx is told the old ones are gone, and once Lynx hands their cells back it shows
// the background's rows, none twice.

import { describe, expect, it } from "@rstest/core";

import InnerFrameRow from "../fixtures/threads/lists-in-cells/InnerFrameRow.svelte";
import drawInnerFrameRow from "../fixtures/threads/lists-in-cells/InnerFrameRow.svelte?first-frame";
import InnerRows from "../fixtures/threads/lists-in-cells/InnerRows.svelte";
import drawInnerRows from "../fixtures/threads/lists-in-cells/InnerRows.svelte?first-frame";
import type { SveltePage } from "./svelte-page.ts";
import { startSveltePage } from "./svelte-page.ts";

/** Lynx hands back the inner list's cells it showed, then asks for every row again. */
async function handBackAndShow(page: SveltePage, shown: object[], rows: number): Promise<void> {
	const inner = () => page.engine.list(page.byClass("inner"));
	// Boundary: the cells Lynx showed, as the engine fake hands them back.
	for (const cell of shown) inner().hide(cell as Parameters<ReturnType<typeof inner>["hide"]>[0]);
	await page.settle();
	for (let pass = 0; pass < 3; pass++) {
		for (let index = 0; index < rows; index++) {
			try {
				inner().show(index);
			} catch {
				// A row that waits for the background comes with the next pass.
			}
		}
		await page.settle();
	}
}

describe("a list in a cell", () => {
	it.each([
		[["a"], ["a", "b"], ["head", "a", "b", "d", "tail"]],
		[["a", "b"], ["a"], ["head", "a", "d", "tail"]],
		[["a"], [], ["head", "d", "tail"]],
	])(
		"drawn with rows %j and rendered with %j, shows the background's",
		async (drawn, built, texts) => {
			const page = startSveltePage(InnerRows, {
				props: () => ({ inner: built, log: [] }),
				firstFrame: { draw: drawInnerRows, props: { inner: drawn, log: [] } },
			});
			page.engine.list(page.byClass("page-list")).show(0);
			const shown = drawn.map((_, index) => page.engine.list(page.byClass("inner")).show(index));
			await page.settle();
			await handBackAndShow(page, shown, built.length + 1);
			expect(page.engine.texts()).toEqual(texts);
			expect(page.errors).toEqual([]);
		},
	);

	it("with a row only the first frame draws, lets go of its cell", async () => {
		const page = startSveltePage(InnerFrameRow, {
			props: () => ({ log: [] }),
			firstFrame: { draw: drawInnerFrameRow, props: { log: [] } },
		});
		page.engine.list(page.byClass("page-list")).show(0);
		const shown = [0, 1, 2].map((index) => page.engine.list(page.byClass("inner")).show(index));
		await page.settle();
		await handBackAndShow(page, [shown[1]!], 2);
		expect(page.engine.texts()).toEqual(["head", "a", "z", "tail"]);
		expect(page.errors).toEqual([]);
	});
});
