// A deferred list's initial rows: its first rows render whole on both threads as the page starts,
// deferred or not, so the first frame shows them and hydration adopts them. A list draws
// (10 + preload-buffer-count) × span-count rows, or initial-item-count, counted across its
// `{#each}` blocks and static rows, and up to its initial-scroll-index too, to a cap. The rows after
// wait for Lynx to ask for them, as before.

import { describe, expect, it } from "@rstest/core";

import { readGlobal, removeGlobals } from "../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL } from "../../src/wire/index.ts";
import InitialRows from "../fixtures/threads/InitialRows.svelte";
import drawInitialRows from "../fixtures/threads/InitialRows.svelte?first-frame";
import InitialRowsNested from "../fixtures/threads/InitialRowsNested.svelte";
import drawInitialRowsNested from "../fixtures/threads/InitialRowsNested.svelte?first-frame";
import InitialRowsPlainScrolled from "../fixtures/threads/InitialRowsPlainScrolled.svelte";
import drawInitialRowsPlainScrolled from "../fixtures/threads/InitialRowsPlainScrolled.svelte?first-frame";
import InitialRowsSnippet from "../fixtures/threads/InitialRowsSnippet.svelte";
import drawInitialRowsSnippet from "../fixtures/threads/InitialRowsSnippet.svelte?first-frame";
import InitialRowsTwoLists from "../fixtures/threads/InitialRowsTwoLists.svelte";
import drawInitialRowsTwoLists from "../fixtures/threads/InitialRowsTwoLists.svelte?first-frame";
import { expectInSyncOnceAsked, range } from "./rows-let-go.ts";
import { scroller, scrollThrough } from "./scroll.ts";
import { startSveltePage } from "./svelte-page.ts";
import type { SveltePage } from "./svelte-page.ts";

interface Props {
	count?: number;
	more?: number;
	header?: boolean;
	footer?: boolean;
	defer?: boolean | { unmountRecycled?: boolean };
	fullSpan?: boolean;
	span?: number;
	preload?: number;
	initial?: number | string;
	scrollIndex?: number;
}

interface Feed {
	rows: { id: number; label: string }[];
	more: { id: number; label: string }[];
}

interface Screen {
	span?: number;
	preload?: number;
	initial?: number;
}

/** The keys of the rows `r<from>` to `r<to>`. */
const keys = (from: number, to: number, prefix = "r"): string[] =>
	range(from, to).map((id) => `${prefix}${id}`);

/**
 * Starts the page with its first frame: the ids of the rows the background rendered as it started.
 * With `ask`, Lynx then asks for every row of the list, as it may before the background's first
 * patch: the keys of the rows it gets at once, drawn whole.
 */
function startInitialRows(props: Props = {}, { ask = true } = {}) {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(InitialRows, {
		props: () => ({ handles, ...props }),
		firstFrame: { draw: drawInitialRows, props: { handles: {}, ...props } },
	});
	const atStart = [...(handles["rendered"] as number[])];
	const list = page.engine.list(page.byClass("list"));
	const all = list.updates.at(-1)!.insertAction.map((item) => String(item["item-key"]));
	const whole = ask ? all.filter((_, index) => list.ask(index) !== undefined) : [];
	return { page, handles, list, all, whole, atStart, feed: handles["feed"] as Feed };
}

/**
 * The page hydrated with nothing reported and nothing written again, kept every element of its
 * first frame (hydration makes a block that differs again in place, silently), and stays in sync.
 */
async function expectHydrated(page: SveltePage, { warnings = [] as unknown[] } = {}) {
	const drawn = page.engine.all();
	await page.settle();
	expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
	expect(page.errors).toEqual([]);
	expect(page.warnings).toEqual(warnings);
	const kept = new Set(page.engine.all());
	expect(drawn.filter((element) => !kept.has(element))).toEqual([]);
	await expectInSyncOnceAsked("after hydration", page);
}

/** The keys of a list's rows Lynx gets at once, asking for each as it may before hydration. */
function wholeRows(page: SveltePage, token: string): string[] {
	const list = page.engine.list(page.byClass(token));
	const all = list.updates.at(-1)!.insertAction.map((item) => String(item["item-key"]));
	return all.filter((_, index) => list.ask(index) !== undefined);
}

/** The ids of the rows the main thread asked the background for. */
const shown = (page: SveltePage) =>
	page.messages.flatMap((message) => (message.t === "show" ? message.elements : []));

describe("a deferred list's initial rows", () => {
	it("is drawn whole in the first frame, and rendered by the background as it starts", async () => {
		const { page, list, whole, atStart, all } = startInitialRows();
		expect(all).toHaveLength(30);
		expect(whole).toEqual(keys(1, 10));
		expect(atStart).toEqual(range(1, 10));
		// Lynx gets the row's contents at once, from the first frame.
		expect(page.engine.text(list.show(0))).toBe("Row 1: 0");
		await expectHydrated(page);
	});

	it("is counted on with a footer, which the first frame draws as before", async () => {
		const { page, whole, atStart } = startInitialRows({ footer: true });
		expect(whole).toEqual([...keys(1, 10), "footer"]);
		expect(atStart).toEqual(range(1, 10));
		await expectHydrated(page);
	});

	it("counts a header with no defer as a row of its own", async () => {
		const { page, whole, atStart } = startInitialRows({ header: true, footer: true });
		expect(whole).toEqual(["header", ...keys(1, 9), "footer"]);
		expect(atStart).toEqual(range(1, 9));
		await expectHydrated(page);
	});

	it("is counted across two {#each} blocks, the first in an {#if}", async () => {
		const { page, whole, atStart } = startInitialRows({ count: 4, more: 20 });
		expect(whole).toEqual([...keys(1, 4), ...keys(1001, 1006, "m")]);
		expect(atStart).toEqual([...range(1, 4), ...range(1001, 1006)]);
		await expectHydrated(page);
	});

	it("holds a screen of lines of span-count rows each", async () => {
		const { page, whole } = startInitialRows({ span: 2, count: 40 });
		expect(whole).toEqual(keys(1, 20));
		await expectHydrated(page);
	});

	it("counts a full-span row as a whole line", async () => {
		const { page, whole } = startInitialRows({ span: 2, count: 40, fullSpan: true });
		expect(whole).toEqual(["wide", ...keys(1, 18)]);
		await expectHydrated(page);
	});

	it("holds as many more rows as preload-buffer-count, as Lynx asks for them", async () => {
		const { page, whole } = startInitialRows({ preload: 5 });
		expect(whole).toEqual(keys(1, 15));
		await expectHydrated(page);
	});

	it("reads initial-item-count written as text, and warns of a value that is not a count", async () => {
		const text = startInitialRows({ initial: "3" });
		expect(text.whole).toEqual(keys(1, 3));
		await expectHydrated(text.page);
		const wrong = startInitialRows({ initial: "three" });
		expect(wrong.whole).toEqual(keys(1, 10));
		await expectHydrated(wrong.page, {
			warnings: [
				expect.objectContaining({
					code: "initial_item_count_not_a_count",
					message: expect.stringMatching(
						/^A <list>'s initial-item-count is "three".*\n.*InitialRows\.svelte:\d+:0/,
					),
				}),
			],
		});
	});

	it("holds initial-item-count rows when the list says", async () => {
		const three = startInitialRows({ initial: 3, preload: 5 });
		expect(three.whole).toEqual(keys(1, 3));
		await expectHydrated(three.page);
		const none = startInitialRows({ initial: 0 });
		expect(none.whole).toEqual([]);
		expect(none.atStart).toEqual([]);
		await expectHydrated(none.page);
	});

	it("runs from the start up to initial-scroll-index and a screen past it", async () => {
		const { page, whole } = startInitialRows({ count: 60, scrollIndex: 30 });
		expect(whole).toEqual(keys(1, 40));
		await expectHydrated(page);
	});

	it("stops at the cap, with a warning, when initial-scroll-index is past it", async () => {
		const handles: Record<string, unknown> = {};
		const props = { count: 200, scrollIndex: 150 };
		const page = startSveltePage(InitialRows, {
			props: () => ({ handles, ...props }),
			firstFrame: { draw: drawInitialRows, props: { handles: {}, ...props } },
		});
		expect(handles["rendered"]).toEqual(range(1, 10));
		await page.settle();
		expect(page.warnings).toEqual([
			expect.objectContaining({
				code: "initial_scroll_index_past_initial_rows",
				message: expect.stringMatching(
					/^A <list> starts at initial-scroll-index 150, more than 100 rows down.*\n.*InitialRows\.svelte:\d+:0/,
				),
			}),
		]);
		expect(page.errors).toEqual([]);
	});

	it("does not warn of a list with no deferred row that starts past the cap", async () => {
		const page = startSveltePage(InitialRowsPlainScrolled, {
			firstFrame: { draw: drawInitialRowsPlainScrolled },
		});
		expect(wholeRows(page, "list")).toHaveLength(200);
		await expectHydrated(page);
	});

	it("is counted where a list component renders its rows from a snippet written outside it", async () => {
		const page = startSveltePage(InitialRowsSnippet, {
			firstFrame: { draw: drawInitialRowsSnippet },
		});
		expect(wholeRows(page, "list")).toEqual(keys(1, 10, "s"));
		await expectHydrated(page);
	});

	it("is counted for each of two lists of a row component whose root is the deferred row", async () => {
		const page = startSveltePage(InitialRowsTwoLists, {
			firstFrame: { draw: drawInitialRowsTwoLists },
		});
		expect(wholeRows(page, "first")).toEqual(keys(1, 10, "a"));
		expect(wholeRows(page, "second")).toEqual(keys(1, 10, "b"));
		await expectHydrated(page);
	});

	it("leaves a list with no deferred row as it was: every row drawn whole", async () => {
		const { page, whole, all, list } = startInitialRows({ defer: false, footer: true });
		expect(whole).toEqual(all);
		expect(all).toHaveLength(31);
		const attributes = Object.keys(page.engine.state(page.byClass("list")).attrs);
		expect(attributes.filter((name) => name.startsWith("sohedra"))).toEqual([]);
		expect(page.engine.text(list.show(29))).toBe("Row 30: 0");
		await expectHydrated(page);
	});

	it("gives a row's contents to a nested list, which counts its own initial rows", async () => {
		const page = startSveltePage(InitialRowsNested, {
			firstFrame: { draw: drawInitialRowsNested },
		});
		const outer = page.engine.list(page.byClass("outer"));
		expect(outer.ask(0)).toBeDefined();
		expect(outer.ask(10)).toBeUndefined();
		const inner = page.engine.list(page.byClass("inner-1"));
		expect(inner.ask(2)).toBeDefined();
		expect(page.engine.text(inner.show(2))).toBe("Inner 3");
		await page.settle();
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		expect(page.errors).toEqual([]);
		await expectInSyncOnceAsked("after hydration", page);
	});
});

describe("a row among the initial rows, after the page starts", () => {
	it("has the rows ahead of the last one Lynx asked for rendered at hydration, unasked", async () => {
		const { page, list, handles } = startInitialRows({}, { ask: false });
		// Lynx asks for a screen of rows before the first patch: all drawn whole, none waits.
		for (let index = 0; index < 9; index++) expect(list.ask(index)).toBeDefined();
		await page.settle();
		// A fling then finds the next rows written, and none waits for the background.
		expect(handles["rendered"]).toEqual(range(1, 19));
		expect(list.ask(10)).toBeDefined();
		expect(list.ask(18)).toBeDefined();
		await page.settle();
		expect(page.errors).toEqual([]);
		await expectInSyncOnceAsked("after the rows ahead", page);
	});

	it("is a row Lynx asked for: handed back and asked again, it keeps its state", async () => {
		const { page, list, handles } = startInitialRows({}, { ask: false });
		await page.settle();
		const cell = list.show(0);
		page.engine.dispatch(page.byClass("row-1"), { type: "tap" });
		await page.settle();
		list.hide(cell);
		await page.settle();
		expect(list.show(0)).toBe(cell);
		expect(page.engine.text(cell)).toBe("Row 1: 1");
		// Rendered once, as the page started.
		expect((handles["rendered"] as number[]).filter((id) => id === 1)).toEqual([1]);
		await expectInSyncOnceAsked("after the row came back", page);
		expect(page.errors).toEqual([]);
	});

	it("with unmountRecycled, loses its state once the main thread lets go of it", async () => {
		const { page, handles } = startInitialRows({ count: 60, defer: { unmountRecycled: true } });
		await page.settle();
		const scroll = scroller(page.engine, page.byClass("list"));
		scroll.to(0);
		await page.settle();
		page.engine.dispatch(page.byClass("row-1"), { type: "tap" });
		await page.settle();
		expect(page.engine.text(page.byClass("row-1"))).toBe("Row 1: 1");
		await scrollThrough({ scroll, from: 0, to: 40, settle: page.settle });
		expect(handles["unmounted"]).toContain(1);
		await scrollThrough({ scroll, from: 40, to: 0, settle: page.settle });
		expect(page.engine.text(page.byClass("row-1"))).toBe("Row 1: 0");
		await expectInSyncOnceAsked("after scrolling back", page);
		expect(page.errors).toEqual([]);
	});

	it("is not changed by a list's attributes that change later: they act on rows to come", async () => {
		const { page, handles } = startInitialRows({}, { ask: false });
		await page.settle();
		const screen = handles["screen"] as Screen;
		page.asBackground(() => {
			screen.preload = 10;
			screen.span = 2;
			screen.initial = 30;
		});
		await page.settle();
		expect(handles["rendered"]).toEqual(range(1, 10));
		expect(shown(page)).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("leaves rows added before hydration to wait for Lynx, as rows that come later do", async () => {
		const { page, feed, handles, list } = startInitialRows({ count: 5 });
		page.asBackground(() => {
			feed.rows.unshift({ id: 99, label: "Row 99" });
		});
		await page.settle();
		expect(handles["rendered"]).toEqual(range(1, 5));
		expect(list.ask(0)).toBeUndefined();
		await page.settle();
		expect(handles["rendered"]).toContain(99);
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		expect(page.errors).toEqual([]);
		await expectInSyncOnceAsked("after hydration", page);
	});
});

/** The markup of the first frame of a feed of `count` deferred rows, as measured. */
const FIRST_FRAME_BYTES: Record<number, number> = { 1000: 70_697, 5000: 354_697 };

describe.each([1000, 5000])("a first frame of %i deferred rows", (count) => {
	it("draws its initial rows whole and the rest empty, within its budget, as the background renders it", () => {
		// A main thread records one page's first frame: the one drawn before goes first.
		removeGlobals([FIRST_FRAME_GLOBAL]);
		drawInitialRows({ handles: {}, count });
		const markup = (readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => string)({});
		removeGlobals([FIRST_FRAME_GLOBAL]);
		// A row of the fixture drawn whole holds a <view>; one that waits holds nothing.
		expect(markup.split("<view").length - 1).toBe(10);
		expect(markup.length).toBeLessThanOrEqual(FIRST_FRAME_BYTES[count]!);
		const { atStart, page } = startInitialRows({ count }, { ask: false });
		expect(atStart).toEqual(range(1, 10));
		expect(page.errors).toEqual([]);
	});
});
