// Deferred list rows: a `<list-item defer>` on Lynx's async list renders its contents on the
// background only once Lynx first asks for the row, and the rows a few places ahead with it. The
// list answers Lynx's request later, when the row's text comes. With `unmountRecycled`, a row the
// main thread lets go of loses its contents and their state, and renders afresh when shown again.

import { describe, expect, it } from "@rstest/core";

import type { CellItem } from "../../src/wire/index.ts";
import DeferredNested from "../fixtures/threads/DeferredNested.svelte";
import drawDeferredNested from "../fixtures/threads/DeferredNested.svelte?first-frame";
import DeferredRows from "../fixtures/threads/DeferredRows.svelte";
import drawDeferredRows from "../fixtures/threads/DeferredRows.svelte?first-frame";
import { expectInSyncOnceAsked, range } from "./released-rows.ts";
import { scroller, scrollThrough } from "./scroll.ts";
import { startSveltePage } from "./svelte-page.ts";
import type { SveltePage } from "./svelte-page.ts";

interface Feed {
	rows: { id: number; label: string }[];
	show: boolean;
}

type Defer = boolean | { unmountRecycled?: boolean };

/** Starts the page of deferred rows, and lets the threads settle. */
async function deferredRows(
	options: { count?: number; async?: boolean; defer?: Defer; preload?: number } = {},
) {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(DeferredRows, { props: () => ({ handles, ...options }) });
	await page.settle();
	return withPage(page, handles);
}

function withPage(page: SveltePage, handles: Record<string, unknown>) {
	const feed = handles["feed"] as Feed;
	const list = () => page.engine.list(page.byClass("list"));
	/** The ids of the rows whose contents the background rendered, in the order it did. */
	const rendered = () => handles["rendered"] as number[];
	const unmounted = () => handles["unmounted"] as number[];
	/** The ids the main thread asked the background to render, message by message. */
	const shows = () =>
		page.messages.flatMap((message) => (message.t === "show" ? [message.nodes] : []));
	const hides = () =>
		page.messages.flatMap((message) => (message.t === "hide" ? message.nodes : []));
	const firstTexts = () =>
		page.patches
			.flatMap((patch) => patch.items)
			.filter((item): item is CellItem => item[0] === "cell" && item[3] !== undefined);
	const change = async (update: (feed: Feed) => void) => {
		page.asBackground(() => update(feed));
		await page.settle();
	};
	const row = (id: number) => page.byClass(`row-${id}`);
	const tap = async (id: number) => {
		page.engine.dispatch(row(id), { type: "tap" });
		await page.settle();
	};
	return {
		page,
		handles,
		feed,
		list,
		rendered,
		unmounted,
		shows,
		hides,
		firstTexts,
		change,
		row,
		tap,
	};
}

describe("a deferred row", () => {
	it("renders nothing on the background, and sends no text, until Lynx asks for it", async () => {
		const { page, list, rendered, firstTexts } = await deferredRows();
		expect(rendered()).toEqual([]);
		expect(
			page.patches.flatMap((patch) => patch.items).filter((item) => item[0] === "cell"),
		).toEqual([]);
		expect(list().updates.at(-1)!.insertAction).toHaveLength(40);
		expect(page.engine.madeCount("list-item")).toBe(0);
		expect(firstTexts()).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("is rendered when Lynx asks for it, and the list answers Lynx when its text comes", async () => {
		const { page, list, rendered } = await deferredRows();
		expect(list().ask(0)).toBeUndefined();
		const operation = list().operation;
		expect(list().given(operation)).toBeUndefined();
		await page.settle();
		const cell = list().given(operation)!;
		expect(cell).toBeDefined();
		expect(page.engine.text(cell)).toBe("Row 1: 0");
		expect(rendered()).toContain(1);
		// The flush names the request it answers, as the async list needs.
		expect(page.engine.flushes).toContainEqual(
			expect.objectContaining({ operationID: operation, triggerLayout: true }),
		);
		// Asked again, the row is there.
		expect(list().show(0)).toBe(cell);
		await expectInSyncOnceAsked("after the row came", page);
		expect(page.errors).toEqual([]);
	});

	it("keeps its state and handlers once rendered", async () => {
		const { page, list, tap, row } = await deferredRows();
		list().ask(0);
		await page.settle();
		await tap(1);
		expect(page.engine.text(row(1))).toBe("Row 1: 1");
		expect(page.errors).toEqual([]);
	});

	it("asked for twice before it comes, answers both requests with its one cell", async () => {
		const { page, list, rendered } = await deferredRows();
		list().ask(3);
		const first = list().operation;
		list().ask(3);
		const second = list().operation;
		await page.settle();
		expect(list().given(first)).toBeDefined();
		expect(list().given(second)).toBe(list().given(first));
		expect(rendered().filter((id) => id === 4)).toEqual([4]);
		expect(page.errors).toEqual([]);
	});

	it("asked for and then removed from the data, is never answered, and nothing breaks", async () => {
		const { page, list, change, rendered } = await deferredRows();
		list().ask(0);
		const operation = list().operation;
		await change((feed) => feed.rows.shift());
		expect(list().given(operation)).toBeUndefined();
		expect(rendered()).not.toContain(1);
		list().ask(0);
		await page.settle();
		expect(page.engine.text(list().show(0))).toBe("Row 2: 0");
		expect(page.errors).toEqual([]);
	});

	it("changed before Lynx asks for it, comes with the change", async () => {
		const { page, list, change } = await deferredRows();
		await change((feed) => (feed.rows[5]!.label = "Changed"));
		list().ask(5);
		await page.settle();
		expect(page.engine.text(list().show(5))).toBe("Changed: 0");
		await change((feed) => (feed.rows[5]!.label = "Again"));
		expect(page.engine.text(list().show(5))).toBe("Again: 0");
		expect(page.errors).toEqual([]);
	});
});

describe("the rows ahead", () => {
	it("are rendered with the row Lynx asks for: ten, down the list", async () => {
		const { page, list, shows, rendered } = await deferredRows();
		list().ask(0);
		await page.settle();
		expect(shows()).toHaveLength(1);
		const [asked] = shows();
		expect(asked).toHaveLength(11);
		expect([...rendered()].sort((a, b) => a - b)).toEqual(range(1, 11));
		// Shown now, a row ahead comes at once.
		expect(page.engine.text(list().show(10))).toBe("Row 11: 0");
		expect(page.errors).toEqual([]);
	});

	it("are up the list while Lynx asks for lower indexes", async () => {
		const { page, list, rendered } = await deferredRows();
		list().ask(30);
		await page.settle();
		list().ask(29);
		await page.settle();
		expect([...rendered()].sort((a, b) => a - b)).toEqual(range(20, 41).filter((id) => id <= 40));
		expect(page.errors).toEqual([]);
	});

	it("keep ahead of a scroll, so only the first screen waits for the background", async () => {
		const { page, list } = await deferredRows({ count: 100 });
		const scroll = scroller(page.engine, page.byClass("list"));
		let waited = 0;
		for (let first = 0; first <= 80; first++) {
			const before = new Set(scroll.pending.keys());
			scroll.to(first);
			for (const key of scroll.pending.keys()) if (!before.has(key)) waited++;
			await page.settle();
		}
		expect(waited).toBe(9);
		await expectInSyncOnceAsked("after the scroll", page);
		expect(list().updates).toHaveLength(1);
		expect(page.errors).toEqual([]);
	});
});

/**
 * The background's work for 5,000 deferred rows before the first patch, as measured: raise it only
 * on purpose. The patch is the list and its update, whose item info is most of it; no row's
 * contents render, and no row's text is sent.
 */
const START_BUDGET = { ops: 5, bytes: 328_001 };

describe("5,000 deferred rows", () => {
	it("render none of their contents, and send only the list's update, before Lynx asks", async () => {
		const { page, rendered } = await deferredRows({ count: 5000 });
		expect(page.patches).toHaveLength(1);
		const [first] = page.patches;
		expect(first!.items.every((item) => item[0] === "ops")).toBe(true);
		const ops = first!.items.reduce(
			(sum, item) => sum + (item[0] === "ops" ? item[1].length : 0),
			0,
		);
		expect(ops).toBeLessThanOrEqual(START_BUDGET.ops);
		expect(JSON.stringify(first).length).toBeLessThanOrEqual(START_BUDGET.bytes);
		expect(rendered()).toEqual([]);
		expect(page.errors).toEqual([]);
	});
});

describe("defer on a list that is not Lynx's async list", () => {
	it("is reported once, and its rows render at once", async () => {
		const { page, rendered, list } = await deferredRows({ async: false, count: 5 });
		expect(page.errors.map((error) => (error as { code?: string }).code)).toEqual([
			"list_item_defer_needs_async_list",
		]);
		expect(String(page.errors[0])).toContain('custom-list-name="list-container"');
		expect([...rendered()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
		expect(page.engine.text(list().show(2))).toBe("Row 3: 0");
	});
});

describe("defer with unmountRecycled", () => {
	async function scrolledAway(defer: Defer) {
		const rows = await deferredRows({ defer });
		const scroll = scroller(rows.page.engine, rows.page.byClass("list"));
		const through = (from: number, to: number) =>
			scrollThrough({ scroll, from, to, settle: rows.page.settle });
		scroll.to(0);
		await rows.page.settle();
		scroll.to(0);
		await rows.tap(1);
		await through(0, 31);
		return { ...rows, scroll, through };
	}

	it("unmounts the contents of a row the main thread let go of, which renders afresh", async () => {
		const { page, unmounted, hides, through, row, rendered } = await scrolledAway({
			unmountRecycled: true,
		});
		expect(hides().length).toBeGreaterThan(0);
		expect(unmounted()).toContain(1);
		await through(31, 0);
		expect(rendered().filter((id) => id === 1).length).toBe(2);
		expect(page.engine.text(row(1))).toBe("Row 1: 0");
		await expectInSyncOnceAsked("after scrolling back", page);
		expect(page.errors).toEqual([]);
	});

	it("is needed: without it, a row keeps its contents and their state", async () => {
		const { page, unmounted, hides, through, row } = await scrolledAway(true);
		expect(hides()).toEqual([]);
		expect(unmounted()).toEqual([]);
		await through(31, 0);
		expect(page.engine.text(row(1))).toBe("Row 1: 1");
		expect(page.errors).toEqual([]);
	});
});

describe("a deferred row in the first frame", () => {
	it("is drawn empty, and a request made before the first patch is answered after hydration", async () => {
		const handles: Record<string, unknown> = {};
		const page = startSveltePage(DeferredRows, {
			props: () => ({ handles }),
			firstFrame: { draw: drawDeferredRows, props: { handles: {} } },
		});
		const list = page.engine.list(page.byClass("list"));
		expect(list.updates.at(-1)!.insertAction).toHaveLength(40);
		expect(list.ask(0)).toBeUndefined();
		const operation = list.operation;
		await page.settle();
		const cell = list.given(operation);
		expect(cell).toBeDefined();
		expect(page.engine.text(cell!)).toBe("Row 1: 0");
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		await expectInSyncOnceAsked("after hydration", page);
		expect(page.errors).toEqual([]);
	});
});

describe("a deferred row in a list inside a row", () => {
	it("renders at once, in the first frame's page as in any other", async () => {
		const page = startSveltePage(DeferredNested, {
			props: () => ({ rows: ["a", "b"] }),
			firstFrame: { draw: drawDeferredNested, props: { rows: ["a", "b"] } },
		});
		const outer = page.engine.list(page.byClass("outer"));
		expect(outer.ask(0)).toBeDefined();
		expect(outer.ask(1)).toBeUndefined();
		await page.settle();
		// The inner list's rows come with their row, and need no request.
		const inner = page.engine.list(page.byClass("inner"));
		expect(page.engine.text(inner.show(1))).toBe("b");
		expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
		await expectInSyncOnceAsked("after hydration", page);
		expect(page.errors).toEqual([]);
	});
});

describe("deferred rows in a first frame that is not hydrated", () => {
	it("are asked for again on the page written again", async () => {
		const page = startSveltePage(DeferredNested, {
			props: () => ({ rows: ["a", "b"], mark: "background" }),
			firstFrame: { draw: drawDeferredNested, props: { rows: ["a", "c"] } },
		});
		const outer = page.engine.list(page.byClass("outer"));
		outer.ask(0);
		outer.ask(1);
		await page.settle();
		await expectInSyncOnceAsked("after the page was written again", page);
		expect(page.errors.map((error) => (error as { code?: string }).code)).toEqual([
			"hydration_mismatch",
		]);
	});
});
