// Events on the first frame before the background adopts it: an event a drawn element listens to
// (a scroll-view's `scroll`, which Lynx sends only to a listener) and a tap the page catches on its
// way are kept, and replayed in order through the background's handlers once it adopts the frame,
// a catch stopping a tap as Lynx's does.

import { describe, expect, it } from "@rstest/core";

import FrameEvents from "../fixtures/threads/FrameEvents.svelte";
import drawFrameEvents from "../fixtures/threads/FrameEvents.svelte?first-frame";
import FrameListen from "../fixtures/threads/FrameListen.svelte";
import drawFrameListen from "../fixtures/threads/FrameListen.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

function drawnEvents() {
	const log: unknown[] = [];
	const page = startSveltePage(FrameEvents, {
		props: () => ({ log }),
		firstFrame: { draw: drawFrameEvents, props: { log } },
	});
	return { page, log };
}

describe("events on the first frame", () => {
	it("listens where the markup does, before the background runs", () => {
		const { page } = drawnEvents();
		const names = page.engine
			.state(page.byClass("scroller"))
			.listeners.map((listener) => listener.name);
		expect(names).toEqual(["scroll"]);
	});

	it("replays them in order, through the handlers the background bound", async () => {
		const { page, log } = drawnEvents();
		page.engine.fire(page.byClass("scroller"), { type: "scroll", detail: { scrollTop: 12 } });
		page.engine.dispatch(page.byClass("leaf"), { type: "tap" });
		page.engine.dispatch(page.byClass("inside"), { type: "tap" });
		expect(log).toEqual([]);
		await page.settle();
		expect(log).toEqual([["scroll", { scrollTop: 12 }], ["bubbles"], ["outer"], ["caught"]]);
		expect(page.errors).toEqual([]);
	});

	it("are the background's own after hydration, once each", async () => {
		const { page, log } = drawnEvents();
		await page.settle();
		page.engine.dispatch(page.byClass("leaf"), { type: "tap" });
		await page.settle();
		expect(log).toEqual([["bubbles"], ["outer"]]);
	});
});

describe("a listener the background adds in code to a drawn element", () => {
	it("is bound once the element is adopted, and hears a tap", async () => {
		const log: unknown[] = [];
		const page = startSveltePage(FrameListen, {
			props: () => ({ log }),
			firstFrame: { draw: drawFrameListen, props: { log } },
		});
		const box = page.byClass("box");
		await page.settle();
		expect(page.byClass("box")).toBe(box);
		page.engine.dispatch(page.byClass("inner"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["on"]);
		expect(page.errors).toEqual([]);
	});
});
