// Main-thread events: a `main-thread:` event attribute binds its function on the element, in each of
// its four spellings and through a spread, and the engine runs it on the main thread with no round
// trip. The engine holds one entry for each event, so a handler built again is the entry's new
// function, with no moment where the event has none.

import { describe, expect, it } from "@rstest/core";

import Events from "../../fixtures/threads/functions/Events.svelte";
import drawEvents from "../../fixtures/threads/functions/Events.svelte?first-frame";
import { startFunctionsPage, tap } from "./pages.ts";

async function events(firstFrame = false) {
	const log: unknown[] = [];
	const api: Record<string, () => void> = {};
	const page = startFunctionsPage(Events, { draw: drawEvents, props: { log, api }, firstFrame });
	await page.settle();
	return { page, log, api };
}

describe("a main-thread event", () => {
	it("binds its function with __AddEvent, in each spelling, and no listener or attribute", async () => {
		const { page } = await events();
		const bound = (token: string) =>
			page.engine
				.state(page.byClass(token))
				.mainThreadEvents.map(({ eventType, eventName }) => `${eventType}:${eventName}`);
		expect(bound("tap")).toEqual(["bindEvent:tap"]);
		expect(bound("catch")).toEqual(["catchEvent:tap"]);
		expect(bound("capture")).toEqual(["capture-bind:tap"]);
		expect(page.engine.state(page.byClass("tap")).listeners).toEqual([]);
		expect(page.engine.state(page.byClass("tap")).attrs).toEqual({});
		expect(page.errors).toEqual([]);
	});

	it("runs on the main thread, bubbles, and stops where its function says", async () => {
		const { page, log } = await events();
		await tap(page, "tap");
		await tap(page, "catch");
		await tap(page, "inside");
		await tap(page, "stop");
		expect(log).toEqual(["tap 1", "outer", "caught", "capture", "outer", "stopped"]);
		expect(page.errors).toEqual([]);
	});

	it("binds through a spread, and lets go when the spread drops it", async () => {
		const { page, log, api } = await events();
		await tap(page, "spread");
		page.asBackground(() => api["unbind"]!());
		await page.settle();
		await tap(page, "spread");
		await tap(page, "tap");
		expect(log).toEqual(["spread", "outer", "outer", "outer"]);
		expect(page.engine.state(page.byClass("spread")).mainThreadEvents).toEqual([]);
		page.asBackground(() => api["bind"]!());
		await page.settle();
		await tap(page, "spread");
		expect(log.slice(4)).toEqual(["spread", "outer"]);
	});

	it("runs a handler built again from the next event on, through the entry the engine holds", async () => {
		const { page, log, api } = await events();
		const engineCalls = page.engine.workletEvents.length;
		const button = page.byClass("tap");
		page.engine.dispatch(button, { type: "tap" });
		page.asBackground(() => api["next"]!());
		await page.settle();
		page.engine.dispatch(button, { type: "tap" });
		page.asBackground(() => api["next"]!());
		// Svelte's update runs first, as the background's: the patch it sends comes after this tap.
		await Promise.resolve();
		page.engine.dispatch(button, { type: "tap" });
		await page.settle();
		page.engine.dispatch(button, { type: "tap" });
		await page.settle();
		expect(log.filter((entry) => String(entry).startsWith("tap"))).toEqual([
			"tap 1",
			"tap 2",
			"tap 2",
			"tap 3",
		]);
		// No `__AddEvent` since the first: the entry the engine holds runs the new function.
		expect(page.engine.workletEvents.length).toBe(engineCalls);
	});

	it("is bound from the first frame, in its first frame's spelling, and kept by hydration", async () => {
		const log: unknown[] = [];
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Events, {
			draw: drawEvents,
			props: { log, api },
			firstFrame: true,
		});
		const button = page.byClass("tap");
		const bindings = page.engine.workletEvents.length;
		expect(page.engine.state(button).mainThreadEvents).toHaveLength(1);
		await page.settle();
		expect(page.byClass("tap")).toBe(button);
		// Hydration bound nothing again: the entries the frame bound run the background's copies.
		expect(page.engine.workletEvents.length).toBe(bindings);
		await tap(page, "spread");
		await tap(page, "tap");
		expect(log).toEqual(["spread", "outer", "tap 1", "outer"]);
		expect(page.errors).toEqual([]);
	});
});
