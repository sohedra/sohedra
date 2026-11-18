// An infinite scroll appends a page of rows while a deferred row Lynx asked for is on its way. Lynx
// marks every bound row dirty at the list's update and asks for each again with a new request
// (core/renderer/ui_component/list/default_list_adapter.cc, OnDataSetChanged and BindItemHolder):
// only the newest request is answered, so Lynx keeps the row it shows, and the row keeps working.

import { expect, it } from "@rstest/core";

import DeferredRows from "../../fixtures/threads/DeferredRows.svelte";
import { scroller, scrollThrough } from "../scroll.ts";
import { startSveltePage } from "../svelte-page.ts";

it("answers only the newest request for a row asked for again by an append", async () => {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(DeferredRows, { props: () => ({ handles, count: 60 }) });
	await page.settle();
	const feed = handles["feed"] as { rows: { id: number; label: string }[] };
	const list = page.engine.list(page.byClass("list"));
	expect(list.ask(4)).toBeUndefined();
	const stale = list.operation;
	// The next page is appended before the row comes; Lynx asks for the row again in its update.
	list.onUpdate = () => {
		list.onUpdate = undefined;
		list.ask(4);
	};
	page.asBackground(() => {
		for (let id = 61; id <= 80; id++) feed.rows.push({ id, label: `Row ${id}` });
	});
	await page.settle();
	const fresh = list.operation;
	expect(fresh).not.toBe(stale);
	const cell = list.given(fresh)!;
	expect(cell).toBeDefined();
	expect(list.given(stale)).toBeUndefined();
	// Rows pass by, enough for the main thread to let go of rows Lynx handed back.
	const scroll = scroller(page.engine, page.byClass("list"));
	await scrollThrough({ scroll, from: 20, to: 60, settle: page.settle });
	const row = page.byClass("row-5");
	page.engine.dispatch(row, { type: "tap" });
	await page.settle();
	expect(page.engine.text(row)).toBe("Row 5: 1");
	expect(page.errors).toEqual([]);
});
