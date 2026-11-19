// An overlay's close request: Android sends `requestclose` for its Back button and iOS sends
// `onRequestClose` for a swipe from the screen's edge. One `onrequestclose` hears both, once per
// request, from the first frame on, and for a main-thread function too.

import { describe, expect, it } from "@rstest/core";

import CloseRequest from "../fixtures/threads/CloseRequest.svelte";
import drawCloseRequest from "../fixtures/threads/CloseRequest.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

const PLATFORMS = [
	["Android", "requestclose"],
	["iOS", "onRequestClose"],
] as const;

function closeRequest(options: { firstFrame?: boolean } = {}) {
	const log: unknown[] = [];
	const props = { log };
	const page = startSveltePage(CloseRequest, {
		props: () => props,
		...(options.firstFrame && { firstFrame: { draw: drawCloseRequest, props } }),
	});
	return { page, log, props };
}

describe("an overlay's onrequestclose", () => {
	it.each(PLATFORMS)("hears %s's request, once", async (_platform, name) => {
		const { page, log } = closeRequest();
		await page.settle();
		page.engine.fire(page.byClass("dialog"), { type: name });
		await page.settle();
		expect(log).toEqual(["close"]);
		expect(page.errors).toEqual([]);
	});

	it("listens under both names, and calls no handler once it goes", async () => {
		const { page, log } = closeRequest();
		await page.settle();
		const names = () =>
			page.engine
				.state(page.byClass("dialog"))
				.listeners.map((listener) => listener.name)
				.sort();
		expect(names()).toEqual(["onRequestClose", "requestclose"]);
		page.engine.fire(page.byClass("dialog"), { type: "requestclose" });
		page.engine.fire(page.byClass("dialog"), { type: "onRequestClose" });
		await page.settle();
		expect(log).toEqual(["close", "close"]);
		page.engine.dispatch(page.byClass("stop"), { type: "tap" });
		await page.settle();
		page.engine.fire(page.byClass("dialog"), { type: "onRequestClose" });
		await page.settle();
		expect(log).toEqual(["close", "close"]);
	});

	it.each(PLATFORMS)(
		"hears %s's request on the first frame, before hydration, once",
		async (_platform, name) => {
			const { page, log } = closeRequest({ firstFrame: true });
			page.engine.fire(page.byClass("dialog"), { type: name });
			await page.settle();
			expect(log).toEqual(["close"]);
			expect(page.errors).toEqual([]);
		},
	);

	it.each(PLATFORMS)(
		"runs a main-thread function for %s's request, once",
		async (_platform, name) => {
			const { page } = closeRequest();
			await page.settle();
			page.engine.fire(page.byClass("sheet"), { type: name });
			expect(page.engine.mainThreadRuns.map((run) => run.name)).toEqual([name]);
			expect(page.errors).toEqual([]);
		},
	);
});
