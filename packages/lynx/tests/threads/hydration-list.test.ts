// The first frame of a native list: its cells drawn from the initial data when Lynx asks for them,
// and hydrated by key. Only the cells Lynx holds keep their elements; a cell it handed back is let
// go of, and made from the background's text when Lynx asks for it again. A list whose keys differ
// refuses hydration, and the page written again shows the background's items.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../src/testing/index.ts";
import FrameList from "../fixtures/threads/FrameList.svelte";
import drawFrameList from "../fixtures/threads/FrameList.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

function drawnList(rows: string[], drawnRows = rows) {
	const log: unknown[] = [];
	const page = startSveltePage(FrameList, {
		props: () => ({ rows, log }),
		firstFrame: { draw: drawFrameList, props: { rows: drawnRows, log } },
	});
	const listElement = () => page.byClass("list");
	const list = () => page.engine.list(listElement());
	const tapRow = async (cell: LynxElement) => {
		page.engine.dispatch(cell.firstChild as LynxElement, { type: "tap" });
		await page.settle();
	};
	return { page, log, listElement, list, tapRow };
}

describe("a list's first frame", () => {
	it("tells the list its items, and draws a cell only when Lynx asks for it", () => {
		const { page, list } = drawnList(["a", "b", "c"]);
		expect(
			list()
				.updates.at(-1)!
				.insertAction.map((item) => item["item-key"]),
		).toEqual(["a", "b", "c"]);
		expect(page.engine.madeCount("list-item")).toBe(0);
		expect(page.engine.text(list().show(1))).toBe("b");
	});

	it("keeps the cells Lynx holds, lets go of one it handed back, and makes the rest later", async () => {
		const { page, list, listElement, log, tapRow } = drawnList(["a", "b", "c"]);
		const first = list().show(0);
		const second = list().show(1);
		list().hide(second);
		const updates = list().updates.length;
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(listElement().childNodes[0]).toBe(first);
		expect([...listElement().childNodes]).not.toContain(second);
		// Lynx knows the items already: it is told nothing again.
		expect(list().updates).toHaveLength(updates);
		await tapRow(first);
		expect(log).toEqual(["a"]);
		const again = list().show(1);
		expect(again).not.toBe(second);
		expect(page.engine.text(again)).toBe("b");
		const third = list().show(2);
		expect(page.engine.text(third)).toBe("c");
		await tapRow(third);
		expect(log).toEqual(["a", "c"]);
	});

	it("whose keys differ refuses hydration, and the list shows the background's items", async () => {
		const { page, list, tapRow, log } = drawnList(["a", "b"], ["a", "x", "b"]);
		list().show(0);
		await page.settle();
		expect(page.errors.map((error) => (error as { code?: string }).code)).toEqual([
			"hydration_mismatch",
		]);
		expect((page.errors[0] as Error).message).toContain(
			"the items of the <list> differ: the background has the keys a, b, and the first frame a, x, b",
		);
		expect(
			list()
				.updates.at(-1)!
				.insertAction.map((item) => item["item-key"]),
		).toEqual(["a", "b"]);
		const cells = [0, 1].map((index) => list().show(index));
		expect(cells.map((cell) => page.engine.text(cell))).toEqual(["a", "b"]);
		await tapRow(cells[1]!);
		expect(log).toEqual(["b"]);
	});
});
