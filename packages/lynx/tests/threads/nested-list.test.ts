// A <list> inside a list cell: its items come with the cell, and the main thread writes its update.
// It hears of its items when Lynx first shows the cell, and of later changes as they come.

import { describe, expect, it } from "@rstest/core";

import NestedList from "../fixtures/threads/NestedList.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function nestedList() {
	const page = startSveltePage(NestedList);
	await page.settle();
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	const keys = (token: string) =>
		page.engine
			.list(page.byClass(token))
			.updates.map((update) => update.insertAction.map((action) => action["item-key"]));
	return { page, tap, keys };
}

describe("a <list> in a list cell", () => {
	it("hears of its items when Lynx first shows the cell", async () => {
		const { page, tap, keys } = await nestedList();
		await tap("add");
		expect(page.engine.madeCount("list")).toBe(1);
		page.engine.list(page.byClass("outer")).show(1);
		expect(keys("inner-2")).toEqual([["inner-1", "inner-2", "inner-3"]]);
		expect(page.errors).toEqual([]);
	});

	it("hears of an item that joins once its cell is shown", async () => {
		const { page, tap, keys } = await nestedList();
		await tap("add");
		page.engine.list(page.byClass("outer")).show(1);
		await tap("grow");
		expect(keys("inner-2")).toEqual([["inner-1", "inner-2", "inner-3"], ["inner-4"]]);
		const inner = page.engine.list(page.byClass("inner-2"));
		expect(page.engine.text(inner.show(3))).toBe("inner-4");
		expect(page.errors).toEqual([]);
	});
});
