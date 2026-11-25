// A hydration that throws part way, here because the engine fails a call: the error is reported
// once, the main thread asks the background to write the page again, and the page that replaces
// the first frame has each element once and every handler.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../src/testing/index.ts";
import FrameCounterInBlock from "../fixtures/threads/FrameCounterInBlock.svelte";
import FrameListAfterBlock from "../fixtures/threads/FrameListAfterBlock.svelte";
import { startSveltePage } from "./svelte-page.ts";
import type { SveltePage } from "./svelte-page.ts";

/** The engine fails the first time the page takes an element off another from now on. */
function failFirstRemoval(page: SveltePage): void {
	const functions = page.engine.functions;
	const remove = functions.__RemoveElement;
	let removals = 0;
	functions.__RemoveElement = (parent, child) => {
		if (++removals === 1) throw new Error("the engine failed");
		remove(parent, child);
	};
}

const errorTexts = (page: SveltePage): string[] => page.errors.map((error) => String(error));

describe("a hydration that fails part way", () => {
	it("reports the error once, and the page written again has its root once", async () => {
		// A drawn <text> in a block's other branch, where the background has its <view>: made in place.
		const page = startSveltePage(FrameCounterInBlock, {
			firstFrame: () => `<!--[-1--><text class="root">Taps: 0 (even)</text><!--]-->`,
		});
		const drawn = page.byClass("root");
		failFirstRemoval(page);
		await page.settle();
		expect(errorTexts(page)).toEqual(["Error: the engine failed"]);
		const roots = page.engine.all().filter((element) => page.engine.state(element).tag === "view");
		expect(roots.filter((element) => page.engine.state(element).classes === "root")).toHaveLength(
			1,
		);
		expect(page.engine.all()).not.toContain(drawn);
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(page.errors).toHaveLength(1);
	});

	it("after a list was drawn, makes each of its cells once from the page written again", async () => {
		const log: unknown[] = [];
		// A drawn <view> in a block the background renders empty: taken off.
		const page = startSveltePage(FrameListAfterBlock, {
			props: () => ({ rows: ["a", "b", "c"], log }),
			firstFrame: () =>
				`<!--[-1--><view class="extra"></view><!--]--><list class="list">` +
				["a", "b", "c"]
					.map(
						(row) =>
							`<list-item item-key="${row}" reuse-identifier="row"><text class="row">${row}</text></list-item>`,
					)
					.join("") +
				`</list>`,
		});
		const drawnList = page.byClass("list");
		page.engine.list(drawnList).show(0);
		failFirstRemoval(page);
		await page.settle();
		expect(errorTexts(page)).toEqual(["Error: the engine failed"]);
		const list = page.byClass("list");
		expect(list).not.toBe(drawnList);
		const cells = [0, 1, 2].map((index) => page.engine.list(list).show(index));
		expect(cells.map((cell) => page.engine.text(cell))).toEqual(["a", "b", "c"]);
		expect(cells.map((cell) => cell.childNodes.length)).toEqual([1, 1, 1]);
		page.engine.dispatch(cells[2]!.firstChild as LynxElement, { type: "tap" });
		await page.settle();
		expect(log).toEqual(["c"]);
		expect(page.errors).toHaveLength(1);
	});
});
