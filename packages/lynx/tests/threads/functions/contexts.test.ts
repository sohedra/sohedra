// The contexts of main-thread functions: a function that calls the background gets one each time
// it is sent, where its op becomes text, and only then; one that calls none gets none. The main
// thread holds a context while it holds the function, and lets the background know when it lets
// go of text that named one unread.

import { describe, expect, it } from "@rstest/core";

import { keptContexts } from "../../../src/background/functions/calls.ts";
import type { CellItem } from "../../../src/wire/index.ts";
import FunctionRows from "../../fixtures/threads/functions/FunctionRows.svelte";
import drawFunctionRows from "../../fixtures/threads/functions/FunctionRows.svelte?first-frame";
import PureRows from "../../fixtures/threads/functions/PureRows.svelte";
import drawPureRows from "../../fixtures/threads/functions/PureRows.svelte?first-frame";
import { holdRequests } from "../rows-let-go.ts";
import { scroller, scrollThrough } from "../scroll.ts";
import { expectAccounted, unheld } from "./accounting.ts";
import { startFunctionsPage } from "./pages.ts";

describe("a main-thread function's context", () => {
	it("is not given to a function that calls nothing on the background: 1,000 rows hold none", async () => {
		const page = startFunctionsPage(PureRows, { draw: drawPureRows });
		await page.settle();
		const scroll = scroller(page.engine, page.byClass("list"));
		await scrollThrough({ scroll, from: 0, to: 40, settle: page.settle });
		expect(page.asBackground(keptContexts)).toEqual([]);
		expect(page.runtime.page.functions.sizes().contexts).toEqual([]);
		page.engine.dispatch(page.byClass("row-40"), { type: "tap" });
		expect(page.engine.state(page.byClass("row-40")).inlineStyles.get("opacity")).toBe("0.5");
	});

	it("is listed by the cell item whose text holds it, and held once the cell is made", async () => {
		const log: unknown[] = [];
		const page = startFunctionsPage(FunctionRows, {
			draw: drawFunctionRows,
			props: { log, api: {} },
		});
		await page.settle();
		const cells = page.patches
			.flatMap((patch) => patch.items)
			.filter((item): item is CellItem => item[0] === "cell");
		expect(cells).toHaveLength(40);
		expect(cells.every((cell) => cell[3] === null && cell[4]?.length === 1)).toBe(true);
		expect(page.asBackground(keptContexts)).toHaveLength(40);
		expectAccounted(page, "the rows' texts");
		scroller(page.engine, page.byClass("list")).to(0);
		await page.settle();
		expect(page.runtime.page.functions.sizes().contexts).toHaveLength(9);
		expectAccounted(page, "the rows shown");
	});

	it("is let go of on both threads when a text that held it goes unread", async () => {
		const log: unknown[] = [];
		const api: Record<string, unknown> = {};
		const page = startFunctionsPage(FunctionRows, { draw: drawFunctionRows, props: { log, api } });
		await page.settle();
		scroller(page.engine, page.byClass("list")).to(0);
		await page.settle();
		page.asBackground(() => (api["rows"] as number[]).splice(20));
		await page.settle();
		expect(page.asBackground(keptContexts)).toHaveLength(20);
		expectAccounted(page, "rows removed unread");
		expect(page.messages.filter((message) => message.t === "release")).toHaveLength(1);
	});

	it("is let go of by the background when the page reloads", async () => {
		const log: unknown[] = [];
		const page = startFunctionsPage(FunctionRows, {
			draw: drawFunctionRows,
			props: { log, api: {} },
		});
		await page.settle();
		page.reload();
		await page.settle();
		expectAccounted(page, "after a reload");
		expect(page.asBackground(keptContexts)).toHaveLength(40);
	});
});

describe("the contexts of rows written again", () => {
	it("are let go of when Lynx took the row back first, and the row's own still call", async () => {
		const log: unknown[][] = [];
		const page = startFunctionsPage(FunctionRows, {
			draw: drawFunctionRows,
			props: { log, api: {} },
		});
		await page.settle();
		const scroll = scroller(page.engine, page.byClass("list"));
		scroll.to(0);
		await page.settle();
		const first = page.byClass("row-1");
		// The answers come after Lynx asked for the rows again: the main thread ignores them.
		const hold = holdRequests(page);
		await scrollThrough({ scroll, from: 0, to: 31, settle: page.settle });
		await scrollThrough({ scroll, from: 31, to: 0, settle: page.settle });
		hold.deliver();
		await page.settle();
		expect(page.byClass("row-1")).toBe(first);
		expectAccounted(page, "after the ignored answers");
		expect(unheld(page)).toEqual([]);
		page.engine.dispatch(first, { type: "tap" });
		await page.settle();
		expect(log).toEqual([["tap", 1]]);
	});
});
