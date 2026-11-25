// Lynx's <list>: the background tracks the items and sends the list's update ready to set; each
// cell's ops travel as text of their own, and the main thread makes a cell, its element and what
// is in it, only when Lynx asks for it. A cell Lynx hands back stays for reuse, and leaves once it
// is no longer an item; past a screen of such cells, the oldest are let go of
// (./list-release.test.ts).

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/element.ts";
import type { LynxElement } from "../../src/testing/index.ts";
import NativeList from "../fixtures/threads/NativeList.svelte";
import StyledRows from "../fixtures/threads/StyledRows.svelte";
import { startSveltePage } from "./svelte-page.ts";

interface Feed {
	rows: string[];
	suffix: string;
	sticky: boolean;
	show: boolean;
	tapped: string;
}

async function nativeList() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(NativeList, { props: () => ({ handles }) });
	await page.settle();
	const feed = handles["feed"] as Feed;
	const change = async (update: (feed: Feed) => void) => {
		page.asBackground(() => update(feed));
		await page.settle();
	};
	const listElement = () => page.byClass("list");
	const list = () => page.engine.list(listElement());
	const show = (index: number) => list().show(index);
	const shown = () =>
		[...listElement().childNodes].map((cell) => page.engine.text(cell as LynxElement));
	const lastUpdate = () => list().updates.at(-1)!;
	return { page, feed, change, listElement, list, show, shown, lastUpdate };
}

describe("<list>", () => {
	it("sends each cell as text of its own", async () => {
		const { page } = await nativeList();
		const cells = page.patches[0]!.items.filter((item) => item[0] === "cell");
		expect(cells).toHaveLength(3);
		for (const cell of cells) expect(typeof cell[2]).toBe("string");
	});

	it("tells the list its items, and makes no cell before Lynx asks", async () => {
		const { page, listElement, list, lastUpdate } = await nativeList();
		expect(listElement().childNodes).toHaveLength(0);
		expect(page.engine.madeCount("list-item")).toBe(0);
		expect(page.engine.madeCount("text")).toBe(0);
		expect(list().updates).toHaveLength(1);
		expect(lastUpdate()).toEqual({
			insertAction: ["a", "b", "c"].map((key, position) => ({
				position,
				type: "row",
				"item-key": key,
				"reuse-identifier": "row",
				"sticky-top": false,
			})),
			removeAction: [],
			updateAction: [],
		});
	});

	it("makes a cell when Lynx asks, with the changes and handlers it collected", async () => {
		const { page, feed, change, show } = await nativeList();
		await change((feed) => (feed.suffix = "!"));
		expect(page.engine.madeCount("text")).toBe(0);
		const cell = show(2);
		expect(page.engine.madeCount("text")).toBe(1);
		expect(page.engine.text(cell)).toBe("c!");
		page.engine.dispatch(cell.firstChild as LynxElement, { type: "tap" });
		await page.settle();
		expect(feed.tapped).toBe("c");
		await change((feed) => (feed.suffix = ""));
		expect(page.engine.text(cell)).toBe("c");
		expect(page.errors).toEqual([]);
	});

	it("puts a cell in the list when Lynx asks for its index, once", async () => {
		const { page, listElement, show, shown } = await nativeList();
		show(2);
		const cell = show(1);
		expect(page.engine.state(cell).tag).toBe("list-item");
		expect(shown()).toEqual(["c", "b"]);
		expect(page.engine.flushes.at(-1)).toEqual({
			triggerLayout: true,
			operationID: 2,
			elementID: page.engine.state(cell).uid,
			listID: page.engine.state(listElement()).uid,
		});
		expect(show(1)).toBe(cell);
		expect(shown()).toEqual(["c", "b"]);
	});

	it("keeps the info only the list reads off the element", async () => {
		const { page, show } = await nativeList();
		const attrs = page.engine.state(show(0)).attrs;
		expect(attrs["item-key"]).toBe("a");
		expect(attrs["sticky-top"]).toBe(false);
		expect(attrs["reuse-identifier"]).toBeUndefined();
	});

	it("sends removals and inserts, and drops a shown cell only once Lynx hands it back", async () => {
		const { change, list, show, shown, lastUpdate } = await nativeList();
		const b = show(1);
		await change((feed) => (feed.rows = ["d", "a", "c"]));
		expect(lastUpdate()).toMatchObject({
			insertAction: [{ position: 0, "item-key": "d" }],
			removeAction: [1],
			updateAction: [],
		});
		expect(shown()).toContain("b");
		list().hide(b);
		expect(shown()).not.toContain("b");
	});

	it("drops a cell Lynx handed back when it stops being an item", async () => {
		const { change, list, show, shown } = await nativeList();
		const a = show(0);
		list().hide(a);
		expect(shown()).toEqual(["a"]);
		await change((feed) => (feed.rows = ["b", "c"]));
		expect(shown()).toEqual([]);
	});

	it("indexes by what Lynx was told last", async () => {
		const { page, change, show } = await nativeList();
		await change((feed) => (feed.rows = ["d", "a", "c"]));
		expect(page.engine.text(show(0))).toBe("d");
		expect(page.engine.text(show(2))).toBe("c");
	});

	it("sends a move as a removal and an insert", async () => {
		const { change, lastUpdate } = await nativeList();
		await change((feed) => (feed.rows = ["c", "a", "b"]));
		expect(lastUpdate()).toMatchObject({
			insertAction: [{ position: 0, "item-key": "c" }],
			removeAction: [2],
			updateAction: [],
		});
	});

	it("sends a change of the info of a kept item as an update", async () => {
		const { page, change, show, lastUpdate } = await nativeList();
		const cell = show(2);
		await change((feed) => (feed.sticky = true));
		expect(lastUpdate()).toEqual({
			insertAction: [],
			removeAction: [],
			updateAction: [0, 1, 2].map((position) => ({
				from: position,
				to: position,
				flush: false,
				type: "row",
				"item-key": ["a", "b", "c"][position],
				"reuse-identifier": "row",
				"sticky-top": true,
			})),
		});
		expect(page.engine.state(cell).attrs["sticky-top"]).toBe(true);
	});

	it("answers a request for several cells with one flush of the list", async () => {
		const { page, listElement, list } = await nativeList();
		const element = listElement();
		page.asMainThread(() =>
			list().componentAtIndexes!(element, page.engine.state(element).uid, [0, 1], [7, 8]),
		);
		const flush = page.engine.flushes.at(-1) as { elementIDs: number[]; operationIDs: number[] };
		expect(flush.operationIDs).toEqual([7, 8]);
		expect(flush.elementIDs.map((uid) => page.engine.text(page.engine.byUid(uid)!))).toEqual([
			"a",
			"b",
		]);
	});

	it("answers -1 for an index with no item, and lets a cell it does not know be", async () => {
		const { page, listElement, list } = await nativeList();
		const element = listElement();
		const uid = page.engine.state(element).uid;
		expect(page.asMainThread(() => list().componentAtIndex!(element, uid, 7, 1))).toBe(-1);
		page.asMainThread(() => list().enqueueComponent!(element, uid, 99_999));
		page.asMainThread(() => list().componentAtIndexes!(element, uid, [0, 9], [3, 4], false, true));
		const flushes = page.engine.flushes.slice(-2) as Record<string, unknown>[];
		expect(flushes[0]).toEqual({ asyncFlush: true });
		expect((flushes[1]!["elementIDs"] as number[])[1]).toBe(-1);
		expect(page.errors).toEqual([]);
	});

	it("answers for the new order when Lynx asks inside the update, as iOS does", async () => {
		const { page, change, list, show } = await nativeList();
		const during: string[] = [];
		list().onUpdate = (update) => {
			const items = 3 + update.insertAction.length - update.removeAction.length;
			for (let index = 0; index < items; index++) during.push(page.engine.text(show(index)));
		};
		await change((feed) => (feed.rows = ["z", "b", "c"]));
		list().onUpdate = undefined;
		expect(during).toEqual(["z", "b", "c"]);
	});

	it("answers -1 once the list is gone, and lets go of its cells", async () => {
		const { page, change, listElement, list } = await nativeList();
		const element = listElement();
		const callbacks = list();
		await change((feed) => (feed.show = false));
		expect(page.engine.all()).not.toContain(element);
		const uid = page.engine.state(element).uid;
		expect(page.asMainThread(() => callbacks.componentAtIndex!(element, uid, 0, 1))).toBe(-1);
		expect(page.errors).toEqual([]);
	});
});

describe("a row Lynx has not shown", () => {
	async function styledRows() {
		const handles: Record<string, unknown> = {};
		const page = startSveltePage(StyledRows, { props: () => ({ handles }) });
		await page.settle();
		return { page, handles, list: page.engine.list(page.byClass("list")) };
	}

	it("takes its styles and animations from code once Lynx shows it, and nothing is reported", async () => {
		const { page, list } = await styledRows();
		expect(page.errors).toEqual([]);
		expect(page.engine.animations).toEqual([]);
		const cell = list.show(0);
		const row = cell.firstChild as LynxElement;
		expect(page.engine.state(row).inlineStyles.get("color")).toBe("red");
		expect(page.engine.animations.map((call) => call.element)).toEqual([row]);
		expect(page.errors).toEqual([]);
	});

	it("rejects a read with a message that says the row is not shown", async () => {
		const { page, handles } = await styledRows();
		const answer = page.asBackground(() =>
			(handles["b"] as ElementNode).invoke("boundingClientRect"),
		);
		answer.catch(() => {});
		await page.settle();
		await expect(answer).rejects.toMatchObject({
			code: "element_not_shown",
			message: expect.stringContaining("list row Lynx is not showing"),
		});
		expect(page.errors).toEqual([]);
	});
});
