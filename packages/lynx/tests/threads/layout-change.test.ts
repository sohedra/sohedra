// A `layoutchange` listener added in code to an element that already has a layout. Lynx sends the
// event when it lays the element out and the element listens then: a listener added later hears
// nothing until the layout changes. So it gets the current layout once, as `ResizeObserver` does
// on `observe`: the last layout the page heard for the element, or else what Lynx measures.

import { describe, expect, it } from "@rstest/core";

import Layout from "../fixtures/threads/Layout.svelte";
import { startSveltePage } from "./svelte-page.ts";

const RECT = {
	id: "",
	dataset: {},
	left: 0,
	top: 10,
	right: 30,
	bottom: 50,
	width: 30,
	height: 40,
};

async function layout() {
	const log: unknown[] = [];
	const page = startSveltePage(Layout, { props: () => ({ log }) });
	await page.settle();
	page.engine.respondWith(() => ({ code: 0, data: RECT }));
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	const measured = () =>
		page.engine.invocations.filter((call) => call.method === "boundingClientRect");
	return { page, log, tap, measured };
}

describe("a layoutchange listener added in code", () => {
	it("gets the current layout of an element laid out before, once", async () => {
		const { page, log, tap, measured } = await layout();
		await tap("listen");
		expect(log).toEqual([["box", RECT]]);
		expect(measured().map((call) => call.element)).toEqual([page.byClass("box")]);
		await page.settle();
		expect(log).toHaveLength(1);
		expect(page.errors).toEqual([]);
	});

	it("gets nothing, and nothing is reported, when Lynx cannot measure the element", async () => {
		const { page, log, tap } = await layout();
		page.engine.respondWith(() => ({ code: 6 }));
		await tap("listen");
		expect(log).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("gets the layout the page last heard for the element, and Lynx is not asked", async () => {
		const { page, log, tap, measured } = await layout();
		const detail = { width: 5, height: 6 };
		page.engine.fire(page.byClass("heard"), { type: "layoutchange", detail });
		await page.settle();
		await tap("listen-heard");
		expect(log).toEqual([
			["markup", detail],
			["late", detail],
		]);
		expect(measured()).toEqual([]);
	});

	it("is not answered on an element made with it: Lynx sends the first layout itself", async () => {
		const { page, log, tap, measured } = await layout();
		await tap("add");
		expect(log).toEqual([]);
		expect(measured()).toEqual([]);
		page.engine.fire(page.byClass("fresh"), { type: "layoutchange", detail: RECT });
		await page.settle();
		expect(log).toEqual([["fresh", RECT]]);
	});

	it("gets no second answer when Lynx's own event comes before the measure", async () => {
		const { page, log, tap } = await layout();
		const moved = { width: 1 };
		page.engine.respondWith((_method, _params, element) => {
			// Lynx lays the element out again before it answers the measure.
			page.engine.fire(element, { type: "layoutchange", detail: moved });
			return { code: 0, data: RECT };
		});
		await tap("listen");
		expect(log).toEqual([["box", moved]]);
		// The next listener, alone, gets the layout the page heard last.
		await tap("listen");
		expect(log).toEqual([
			["box", moved],
			["box", moved],
		]);
	});

	it("measures again once the element had no listener: a layout heard before may be stale", async () => {
		const { page, log, tap, measured } = await layout();
		await tap("listen");
		page.engine.fire(page.byClass("box"), { type: "layoutchange", detail: { width: 1 } });
		await page.settle();
		await tap("unlisten");
		// Laid out again while nothing listens: Lynx sends nothing.
		page.engine.respondWith(() => ({ code: 0, data: { width: 2 } }));
		log.length = 0;
		await tap("listen");
		expect(log).toEqual([["box", { width: 2 }]]);
		expect(measured()).toHaveLength(2);
	});
});
