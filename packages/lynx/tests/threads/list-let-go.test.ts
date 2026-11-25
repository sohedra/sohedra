// List rows let go of off screen: past a screen of cells Lynx handed back, the main thread lets go
// of the oldest ones' elements, and the background writes each again from its tree, with the ids
// it has, for the next time Lynx shows it. A row's state lives on the background and stays; what
// only its views held goes. A row never shown keeps one merged text, written again the same way.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/element.ts";
import NestedRows from "../fixtures/threads/NestedRows.svelte";
import { listKeys } from "./generated/trees.ts";
import {
	askedFor,
	holdRequests,
	holdTimers,
	range,
	rowsLetGo,
	rewrittenCells,
} from "./rows-let-go.ts";
import { scroller, scrollThrough } from "./scroll.ts";
import { startSveltePage } from "./svelte-page.ts";

describe("list rows Lynx handed back", () => {
	it("keep a screen of cells, and the oldest past it are released", async () => {
		const { page, through, rowsOnPage } = await rowsLetGo();
		await through(0, 31);
		// Lynx holds rows 32 to 40; the ten handed back last keep their elements.
		expect(rowsOnPage()).toEqual(range(22, 40));
		expect(page.engine.list(page.byClass("list")).updates).toHaveLength(1);
		expect(page.errors).toEqual([]);
	});

	it("are released after Lynx's callback returns, never inside it", async () => {
		const { page, scroll, rowsOnPage } = await rowsLetGo();
		for (let first = 1; first <= 31; first++) scroll.to(first);
		expect(rowsOnPage()).toEqual(range(1, 40));
		await page.settle();
		expect(rowsOnPage()).toEqual(range(22, 40));
	});

	it("keep a screen of what Lynx holds, the preload buffer left out", async () => {
		const { through, rowsOnPage } = await rowsLetGo({ preload: 5 });
		// Rows 16 to 34 are held: one screen and five on each side.
		await through(0, 20);
		expect(rowsOnPage()).toEqual(range(6, 34));
	});

	it("keep a screen of small rows, as many as Lynx holds", async () => {
		const { through, rowsOnPage } = await rowsLetGo({ count: 60, screen: 20 });
		await through(0, 30);
		expect(rowsOnPage()).toEqual(range(11, 50));
	});

	it("show again what the background holds, with their state and handlers", async () => {
		const { page, feed, through, rowsOnPage, row, tap } = await rowsLetGo();
		await tap(1);
		const before = row(1);
		await through(0, 31);
		expect(rowsOnPage()).not.toContain(1);
		await through(31, 0);
		const again = row(1);
		expect(again).not.toBe(before);
		expect(page.engine.text(again)).toBe("Row 1: 1");
		await tap(1);
		expect(page.engine.text(row(1))).toBe("Row 1: 2");
		expect(feed.rows[0]!.label).toBe("Row 1");
		expect(page.errors).toEqual([]);
	});

	it("show a change made while their release was asked for", async () => {
		const { page, through, change, rowsOnPage, row } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		expect(hold.held.length).toBeGreaterThan(0);
		await change((feed) => (feed.rows[0]!.label = "Changed"));
		expect(page.engine.text(row(1))).toBe("Changed: 0");
		hold.deliver();
		await page.settle();
		expect(rowsOnPage()).not.toContain(1);
		await through(31, 0);
		expect(page.engine.text(row(1))).toBe("Changed: 0");
		expect(page.errors).toEqual([]);
	});

	it("show a change made after their release", async () => {
		const { page, through, change, row } = await rowsLetGo();
		await through(0, 31);
		await change((feed) => (feed.rows[0]!.label = "Changed"));
		await through(31, 0);
		expect(page.engine.text(row(1))).toBe("Changed: 0");
		expect(page.errors).toEqual([]);
	});

	it("keep their elements when Lynx takes them back while their release is on its way", async () => {
		const { page, through, row, rowsOnPage } = await rowsLetGo();
		const first = row(1);
		const hold = holdRequests(page);
		await through(0, 31);
		await through(31, 0);
		hold.deliver();
		await page.settle();
		expect(row(1)).toBe(first);
		expect(rowsOnPage()).toEqual(range(1, 19));
		expect(page.engine.text(first)).toBe("Row 1: 0");
		expect(page.errors).toEqual([]);
	});

	it("are written again for nothing once their list is gone", async () => {
		const { page, through, change } = await rowsLetGo();
		const hold = holdRequests(page);
		await through(0, 31);
		const written = rewrittenCells(page).length;
		await change((feed) => (feed.show = false));
		hold.deliver();
		await page.settle();
		expect(rewrittenCells(page)).toHaveLength(written);
		expect(
			page.engine.all().filter((element) => page.engine.state(element).tag === "list"),
		).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("ask for nothing once the page is destroyed", async () => {
		const { page, scroll } = await rowsLetGo();
		for (let first = 1; first <= 31; first++) scroll.to(first);
		const asked = askedFor(page).length;
		page.destroy();
		await page.settle();
		expect(askedFor(page)).toHaveLength(asked);
		expect(page.errors).toEqual([]);
	});

	it("are kept when their item is not recyclable", async () => {
		const { page, through, rowsOnPage } = await rowsLetGo({ fixed: 1 });
		await through(0, 31);
		expect(rowsOnPage()).toEqual([1, ...range(22, 40)]);
		expect(page.errors).toEqual([]);
	});

	it("reject a read of a let-go row's element, saying Lynx is not showing it", async () => {
		const { page, handles, through } = await rowsLetGo();
		await through(0, 31);
		const answer = page.asBackground(() =>
			(handles["row-1"] as ElementNode).invoke("boundingClientRect"),
		);
		answer.catch(() => {});
		await page.settle();
		await expect(answer).rejects.toMatchObject({
			code: "element_not_shown",
			message: expect.stringContaining("list row Lynx is not showing"),
		});
	});
});

describe("what a let-go row keeps", () => {
	it("keeps its state and an input's value held in it; its animation and its own input go", async () => {
		const { page, handles, through, row, within, tap } = await rowsLetGo();
		await tap(1);
		page.engine.fire(within(row(1), "kept"), { type: "input", detail: { value: "typed" } });
		let ended = "running";
		page.asBackground(() => {
			const node = handles["row-1"] as {
				animate(keyframes: object[], duration: number): { finished: Promise<void> };
			};
			node.animate([{ opacity: 0 }, { opacity: 1 }], 100).finished.then(
				() => (ended = "finished"),
				(error: { code?: string }) => (ended = error.code ?? "rejected"),
			);
		});
		await page.settle();
		expect(page.engine.animations.map((call) => call.element)).toEqual([row(1)]);
		await through(0, 31);
		// The engine cancels an element's animations when the element goes.
		expect(ended).toBe("animation_canceled");
		await through(31, 0);
		expect(page.engine.text(row(1))).toBe("Row 1: 1");
		expect(page.engine.state(within(row(1), "kept")).attrs["default-value"]).toBe("typed");
		expect(page.engine.state(within(row(1), "loose")).attrs["default-value"]).toBeUndefined();
		expect(page.engine.animations.map((call) => call.element)).not.toContain(row(1));
		expect(page.errors).toEqual([]);
	});
});

describe("a list in a let-go row", () => {
	it("goes with its row, and hears of its items again when Lynx shows the row again", async () => {
		const page = startSveltePage(NestedRows);
		await page.settle();
		const scroll = scroller(page.engine, page.byClass("outer"));
		scroll.to(0);
		await page.settle();
		const inner = page.byClass("inner-1");
		const callbacks = page.engine.list(inner);
		expect(page.engine.text(callbacks.show(1))).toBe("1b");
		await scrollThrough({ scroll, from: 0, to: 21, settle: page.settle });
		expect(() => page.byClass("inner-1")).toThrow();
		const uid = page.engine.state(inner).uid;
		expect(page.asMainThread(() => callbacks.componentAtIndex!(inner, uid, 0, 1))).toBe(-1);
		await scrollThrough({ scroll, from: 21, to: 0, settle: page.settle });
		const again = page.byClass("inner-1");
		expect(again).not.toBe(inner);
		expect(listKeys(page.engine, again)).toEqual(["a", "b", "c"]);
		expect(page.engine.text(page.engine.list(again).show(1))).toBe("1b");
		expect(page.errors).toEqual([]);
	});
});

describe("a let-go row", () => {
	it("keeps its changes as one text too, written again once they pile up", async () => {
		const { page, through, change, row } = await rowsLetGo();
		await through(0, 31);
		const before = rewrittenCells(page).length;
		for (let version = 1; version <= 30; version++)
			await change((feed) => (feed.rows[0]!.label = `Row 1, version ${version}`));
		const rewritten = rewrittenCells(page).length - before;
		expect(rewritten).toBeGreaterThan(0);
		expect(rewritten).toBeLessThan(6);
		await through(31, 0);
		expect(page.engine.text(row(1))).toBe("Row 1, version 30: 0");
		expect(page.errors).toEqual([]);
	});
});

describe("a row Lynx never showed", () => {
	it("keeps its changes as one text, written again once they pile up", async () => {
		const { page, change, scroll } = await rowsLetGo();
		for (let version = 1; version <= 30; version++)
			await change((feed) => (feed.rows[39]!.label = `Row 40, version ${version}`));
		const rewritten = rewrittenCells(page);
		expect(rewritten.length).toBeGreaterThan(0);
		expect(rewritten.length).toBeLessThan(5);
		expect(new Set(askedFor(page))).toEqual(new Set([rewritten[0]![1]]));
		scroll.to(31);
		await page.settle();
		expect(page.engine.text(page.byClass("row-40"))).toBe("Row 40, version 30: 0");
		expect(page.errors).toEqual([]);
	});

	it("is not asked for once Lynx shows it before the request goes", async () => {
		const { page, change, scroll } = await rowsLetGo();
		const timers = holdTimers(page);
		for (let version = 1; version <= 30; version++)
			await change((feed) => (feed.rows[39]!.label = `Row 40, version ${version}`));
		expect(timers.held).toHaveLength(1);
		scroll.to(31);
		timers.release();
		timers.run();
		await page.settle();
		expect(askedFor(page)).toEqual([]);
		expect(page.engine.text(page.byClass("row-40"))).toBe("Row 40, version 30: 0");
		expect(page.errors).toEqual([]);
	});

	it("is asked for a few rows at a time, the rest on the next task", async () => {
		const { page, change } = await rowsLetGo({ count: 200 });
		const timers = holdTimers(page);
		for (let tick = 1; tick <= 20; tick++)
			await change((feed) => feed.rows.forEach((item) => (item.label = `Row ${item.id}, ${tick}`)));
		const requests = () =>
			page.messages.flatMap((message) =>
				message.t === "rewrite" ? [message.elements.length] : [],
			);
		timers.run();
		await page.settle();
		expect(requests()).toEqual([64]);
		expect(timers.held).toHaveLength(1);
		timers.release();
		timers.run();
		await page.settle();
		expect(requests().every((count) => count <= 64)).toBe(true);
		expect(requests().reduce((sum, count) => sum + count, 0)).toBeGreaterThan(150);
		expect(page.errors).toEqual([]);
	});
});
