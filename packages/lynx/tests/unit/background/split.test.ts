// The splitter: what goes to the page now, what travels as a cell's own item, and the list
// updates.

import { describe, expect, it } from "@rstest/core";

import { createSplitter } from "../../../src/background/split.ts";
import type { SplitItem } from "../../../src/background/split.ts";
import { encodeCell, OpCode as O, ROOT_ID } from "../../../src/wire/index.ts";
import type { Op } from "../../../src/wire/index.ts";

/** A cell's text, as the channel writes it: these ops hold no main-thread function. */
const cellText = (ops: Op[]) => ({ text: encodeCell(ops), contexts: [] });

const page = (items: SplitItem[]): Op[] =>
	items.flatMap((item) => (item[0] === "ops" ? item[1] : []));
const cells = (items: SplitItem[]) =>
	items.flatMap((item) => (item[0] === "cell" ? [[item[1], JSON.parse(item[2])] as const] : []));

describe("the splitter", () => {
	it("sends nothing for an element until it is inserted under the page", () => {
		const split = createSplitter(cellText);
		expect(
			split.split([
				[O.Create, 2, "view"],
				[O.SetAttr, 2, "class", "a"],
			]),
		).toEqual([]);
		expect(page(split.split([[O.Insert, ROOT_ID, 2, 0]]))).toEqual([
			[O.Create, 2, "view"],
			[O.SetAttr, 2, "class", "a"],
			[O.Insert, ROOT_ID, 2, 0],
		]);
	});

	it("builds a subtree in order when its root is inserted", () => {
		const split = createSplitter(cellText);
		const out = split.split([
			[O.Create, 2, "view"],
			[O.Create, 3, "text"],
			[O.CreateText, 4, "hi"],
			[O.Insert, 3, 4, 0],
			[O.Insert, 2, 3, 0],
			[O.Insert, ROOT_ID, 2, 0],
		]);
		expect(page(out)).toEqual([
			[O.Create, 2, "view"],
			[O.Create, 3, "text"],
			[O.CreateText, 4, "hi"],
			[O.Insert, 3, 4, 0],
			[O.Insert, 2, 3, 0],
			[O.Insert, ROOT_ID, 2, 0],
		]);
	});

	it("drops elements released before they were ever sent", () => {
		const split = createSplitter(cellText);
		split.split([[O.Create, 2, "view"]]);
		expect(split.split([[O.Release, 2]])).toEqual([]);
	});

	it("sends a list's cells as segments and ends the batch with one list update", () => {
		const split = createSplitter(cellText);
		const out = split.split([
			[O.Create, 2, "list"],
			[O.Insert, ROOT_ID, 2, 0],
			[O.Create, 3, "list-item"],
			[O.SetAttr, 3, "item-key", "a"],
			[O.Create, 4, "text"],
			[O.Insert, 3, 4, 0],
			[O.Insert, 2, 3, 0],
		]);
		expect(cells(out)).toEqual([
			[
				3,
				[
					[O.Create, 3, "list-item"],
					[O.SetAttr, 3, "item-key", "a"],
					[O.Create, 4, "text"],
					[O.Insert, 3, 4, 0],
				],
			],
		]);
		const update = page(out).find((op) => op[0] === O.ListUpdate)!;
		expect(update).toEqual([
			O.ListUpdate,
			2,
			{
				insertAction: [{ position: 0, type: "list-item", "item-key": "a" }],
				removeAction: [],
				updateAction: [],
			},
			[3],
			[3],
			[],
		]);
		// Inserts into the list itself never reach the main thread.
		expect(page(out).some((op) => op[0] === O.Insert && op[1] === 2)).toBe(false);
	});

	it("routes later changes inside a cell to the cell's segment, and info changes to a list update", () => {
		const split = createSplitter(cellText);
		split.split([
			[O.Create, 2, "list"],
			[O.Insert, ROOT_ID, 2, 0],
			[O.Create, 3, "list-item"],
			[O.SetAttr, 3, "item-key", "a"],
			[O.Create, 4, "text"],
			[O.Insert, 3, 4, 0],
			[O.Insert, 2, 3, 0],
		]);
		const out = split.split([
			[O.SetAttr, 4, "class", "big"],
			[O.SetAttr, 3, "sticky-top", true],
		]);
		expect(cells(out)).toEqual([
			[
				3,
				[
					[O.SetAttr, 4, "class", "big"],
					[O.SetAttr, 3, "sticky-top", true],
				],
			],
		]);
		const update = page(out).find((op) => op[0] === O.ListUpdate)!;
		expect((update[2] as { updateAction: unknown[] }).updateAction).toEqual([
			{ from: 0, to: 0, flush: false, type: "list-item", "item-key": "a", "sticky-top": true },
		]);
	});

	it("sends styles set from code and animations with their element: pending, in its cell, or now", () => {
		const split = createSplitter(cellText);
		const styles = { color: "red" };
		const fade = [0, "fade", [{ opacity: 0 }], { duration: 1 }];
		expect(
			split.split([
				[O.Create, 2, "view"],
				[O.SetStyles, 2, styles],
			]),
		).toEqual([]);
		expect(page(split.split([[O.Insert, ROOT_ID, 2, 0]]))).toEqual([
			[O.Create, 2, "view"],
			[O.SetStyles, 2, styles],
			[O.Insert, ROOT_ID, 2, 0],
		]);
		expect(page(split.split([[O.Animate, 2, fade]]))).toEqual([[O.Animate, 2, fade]]);
		split.split([
			[O.Create, 3, "list"],
			[O.Insert, ROOT_ID, 3, 0],
			[O.Create, 4, "list-item"],
			[O.Insert, 3, 4, 0],
		]);
		const out = split.split([
			[O.SetStyles, 4, styles],
			[O.Animate, 4, fade],
		]);
		expect(cells(out)).toEqual([
			[
				4,
				[
					[O.SetStyles, 4, styles],
					[O.Animate, 4, fade],
				],
			],
		]);
	});

	it("sends a block's branch mark with the element it marks: pending, or in its cell", () => {
		const split = createSplitter(cellText);
		// `<view>{#if a}<text>{/if}<image></view>`, as the renderer writes it: the mark after the
		// view's first child, before the view is inserted.
		expect(
			page(
				split.split([
					[O.Create, 2, "view"],
					[O.Create, 3, "text"],
					[O.Insert, 2, 3, 0],
					[O.Branch, 2, 0, 1, 1],
					[O.Create, 4, "image"],
					[O.Insert, 2, 4, 0],
					[O.Insert, ROOT_ID, 2, 0],
				]),
			),
		).toEqual([
			[O.Create, 2, "view"],
			[O.Branch, 2, 0, 1, 1],
			[O.Create, 3, "text"],
			[O.Insert, 2, 3, 0],
			[O.Create, 4, "image"],
			[O.Insert, 2, 4, 0],
			[O.Insert, ROOT_ID, 2, 0],
		]);
		split.split([
			[O.Create, 5, "list"],
			[O.Insert, ROOT_ID, 5, 0],
		]);
		const out = split.split([
			[O.Create, 6, "list-item"],
			[O.SetAttr, 6, "item-key", "a"],
			[O.Create, 7, "text"],
			[O.Insert, 6, 7, 0],
			[O.Branch, 6, -1, 1, 1],
			[O.Insert, 5, 6, 0],
		]);
		expect(cells(out)).toEqual([
			[
				6,
				[
					[O.Create, 6, "list-item"],
					[O.SetAttr, 6, "item-key", "a"],
					[O.Branch, 6, -1, 1, 1],
					[O.Create, 7, "text"],
					[O.Insert, 6, 7, 0],
				],
			],
		]);
	});

	it("reports removed cells and sends their release to the page", () => {
		const split = createSplitter(cellText);
		split.split([
			[O.Create, 2, "list"],
			[O.Insert, ROOT_ID, 2, 0],
			[O.Create, 3, "list-item"],
			[O.Insert, 2, 3, 0],
		]);
		const out = split.split([
			[O.Remove, 2, 3],
			[O.Release, 3],
		]);
		expect(page(out)).toEqual([
			[O.Release, 3],
			[O.ListUpdate, 2, { insertAction: [], removeAction: [0], updateAction: [] }, [], [], [3]],
		]);
	});

	it("keeps a list nested inside a cell in that cell (the main thread tracks it)", () => {
		const split = createSplitter(cellText);
		const out = split.split([
			[O.Create, 2, "list"],
			[O.Insert, ROOT_ID, 2, 0],
			[O.Create, 3, "list-item"],
			[O.Create, 4, "list"],
			[O.Create, 5, "list-item"],
			[O.Insert, 4, 5, 0],
			[O.Insert, 3, 4, 0],
			[O.Insert, 2, 3, 0],
		]);
		expect(cells(out)).toEqual([
			[
				3,
				[
					[O.Create, 3, "list-item"],
					[O.Create, 4, "list"],
					[O.Create, 5, "list-item"],
					[O.Insert, 4, 5, 0],
					[O.Insert, 3, 4, 0],
				],
			],
		]);
	});

	it("keeps a pending parent's children in the order of their moves, without the removed ones", () => {
		const split = createSplitter(cellText);
		const out = split.split([
			[O.Create, 2, "view"],
			[O.Create, 3, "view"],
			[O.Create, 4, "view"],
			[O.Create, 5, "view"],
			[O.Insert, 2, 3, 0],
			[O.Insert, 2, 4, 3],
			[O.Insert, 2, 5, 0],
			[O.Insert, 2, 3, 4],
			[O.Remove, 2, 5],
			[O.Insert, ROOT_ID, 2, 0],
		]);
		expect(page(out).filter((op) => op[0] === O.Insert)).toEqual([
			[O.Insert, 2, 3, 0],
			[O.Insert, 2, 4, 0],
			[O.Insert, ROOT_ID, 2, 0],
		]);
	});

	it("takes an item's info out of the list update when it is set to null", () => {
		const split = createSplitter(cellText);
		split.split([
			[O.Create, 2, "list"],
			[O.Insert, ROOT_ID, 2, 0],
			[O.Create, 3, "list-item"],
			[O.SetAttr, 3, "sticky-top", true],
			[O.Insert, 2, 3, 0],
		]);
		const out = split.split([[O.SetAttr, 3, "sticky-top", null]]);
		const update = page(out).find((op) => op[0] === O.ListUpdate)!;
		expect((update[2] as { updateAction: unknown[] }).updateAction).toEqual([
			{ from: 0, to: 0, flush: false, type: "list-item" },
		]);
	});

	it("sends a list update it is given to the page", () => {
		const split = createSplitter(cellText);
		split.split([
			[O.Create, 2, "list"],
			[O.Insert, ROOT_ID, 2, 0],
		]);
		const update: Op = [
			O.ListUpdate,
			2,
			{ insertAction: [], removeAction: [], updateAction: [] },
			[],
			[],
			[],
		];
		expect(page(split.split([update]))).toEqual([update]);
	});
});
