// A row's release while other things happen: the request to write it again is held on its way to
// the background while the rows change, the page reloads, or another request for the same row
// follows. Each ends with Lynx showing what the background rendered, and nothing reported.

import { describe, expect, it } from "@rstest/core";

import { expectInSync, holdRequests, range, rowsLetGo } from "./rows-let-go.ts";
import { scroller, scrollThrough } from "./scroll.ts";

describe("a row's release", () => {
	it("asked for twice, is let go of by the first answer and keeps the change between", async () => {
		const { page, through, rowsOnPage, row, change } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		// Lynx takes the rows back, and hands them back again: a second request for the same rows.
		await through(31, 0);
		await change((feed) => (feed.rows[0]!.label = "Between"));
		await through(0, 31);
		expect(hold.held.length).toBeGreaterThanOrEqual(2);
		hold.deliverOne(0);
		await page.settle();
		await change((feed) => (feed.rows[0]!.label = "After the first"));
		hold.deliver();
		await page.settle();
		expect(rowsOnPage()).toEqual(range(22, 40));
		await through(31, 0);
		expect(page.engine.text(row(1))).toBe("After the first: 0");
		expect(page.errors).toEqual([]);
		expectInSync("After two releases of one row", page);
	});

	it("crossing the row's removal, writes nothing for it", async () => {
		const { page, through, change, rowsOnPage } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		await change((feed) => feed.rows.splice(0, 3));
		hold.deliver();
		await page.settle();
		expect(rowsOnPage()).not.toContain(1);
		await through(28, 0);
		expect(page.errors).toEqual([]);
		expectInSync("After a removal crossing a release", page);
	});

	it("crossing a reverse of the rows, is shown where the row is now", async () => {
		const { page, through, change } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		await change((feed) => feed.rows.reverse());
		hold.deliver();
		await page.settle();
		await through(31, 0);
		expect(page.errors).toEqual([]);
		expectInSync("After a reverse crossing a release", page);
	});

	it("crossing the row taken out and put back with its key, is the row put back", async () => {
		const { page, through, change } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		let first: { id: number; label: string } | undefined;
		await change((feed) => (first = feed.rows.shift()));
		await change((feed) => feed.rows.unshift({ ...first! }));
		hold.deliver();
		await page.settle();
		await through(31, 0);
		expect(page.errors).toEqual([]);
		expectInSync("After a row put back crossing a release", page);
	});

	it("crossing a reload, is dropped by the new page", async () => {
		const { page, through } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		page.reload();
		hold.deliver();
		await page.settle();
		const scroll = scroller(page.engine, page.byClass("list"));
		await scrollThrough({ scroll, from: 0, to: 31, settle: page.settle });
		await scrollThrough({ scroll, from: 31, to: 0, settle: page.settle });
		expect(page.errors).toEqual([]);
		expectInSync("After a reload crossing a release", page);
	});

	it("asked for by the page before a reload, is dropped once the new page shows", async () => {
		const { page, through } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		page.reload();
		await page.settle();
		hold.deliver();
		await page.settle();
		expect(page.errors).toEqual([]);
		expectInSync("After a request of the page before a reload", page);
	});
});
