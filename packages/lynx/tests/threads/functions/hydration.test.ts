// Main-thread functions from the first frame on. The first frame runs its own copies; hydration
// hands each element's to the background's copies on the same element, with the refs the first
// frame's left and the calls of background functions it held, which go out in order with the
// events the first frame heard. A function ref the first frame ran is not run again, unless what
// it captured differs on the background.

import { describe, expect, it } from "@rstest/core";

import Hydrate from "../../fixtures/threads/functions/Hydrate.svelte";
import drawHydrate from "../../fixtures/threads/functions/Hydrate.svelte?first-frame";
import { startFunctionsPage } from "./pages.ts";

function hydrating() {
	const log: unknown[][] = [];
	const api: Record<string, () => Promise<unknown>> = {};
	const page = startFunctionsPage(Hydrate, {
		draw: drawHydrate,
		props: { log, api },
		firstFrame: true,
	});
	const attrs = (token: string) => page.engine.state(page.byClass(token)).attrs;
	return { page, log, api, attrs };
}

describe("a main-thread function on the first frame", () => {
	it("runs before the background has started, and its calls of the background wait", () => {
		const { page, log, attrs } = hydrating();
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		expect(log).toEqual([]);
		expect(attrs("where")["ran-in"]).toBe("frame");
		expect(page.engine.state(page.byClass("else")).inlineStyles.get("opacity")).toBe("0.5");
	});

	it("has its held calls and the events the frame heard reach the background in order, once", async () => {
		const { page, log } = hydrating();
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		page.engine.dispatch(page.byClass("plain"), { type: "tap" });
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		await page.settle();
		expect(log).toEqual([["once"], ["bump", 1], ["plain"], ["bump", 2]]);
		expect(page.errors).toEqual([]);
	});

	it("goes on as the background's copy from what the first frame's left in its refs", async () => {
		const { page, log, api } = hydrating();
		const tapped = page.byClass("tap");
		page.engine.dispatch(tapped, { type: "tap" });
		page.engine.dispatch(tapped, { type: "tap" });
		await page.settle();
		expect(page.byClass("tap")).toBe(tapped);
		const read = page.asBackground(() => api["read"]!());
		await page.settle();
		expect(await read).toBe(2);
		page.engine.dispatch(tapped, { type: "tap" });
		await page.settle();
		expect(log.at(-1)).toEqual(["bump", 3]);
	});

	it("leaves a closure it kept able to call the background, through a function it captured", async () => {
		const { page, log } = hydrating();
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		await page.settle();
		page.engine.dispatch(page.byClass("saved"), { type: "tap" });
		await page.settle();
		expect(log.slice(-2)).toEqual([["bump", 11], ["saved"]]);
		expect(page.errors).toEqual([]);
	});
});

describe("a function ref of the first frame", () => {
	it("runs once across hydration", async () => {
		const { page, log } = hydrating();
		await page.settle();
		expect(log.filter(([what]) => String(what).startsWith("once"))).toEqual([["once"]]);
	});

	it("is cleaned up, and the background's copy run, when what it captured differs", async () => {
		const { page, attrs } = hydrating();
		await page.settle();
		expect(attrs("where")["ran-in"]).toBe("background");
		expect(attrs("outer")["cleaned-frame"]).toBe("yes");
		expect(attrs("outer")["cleaned-background"]).toBeUndefined();
	});

	it("runs in {#if background} at hydration, and is cleaned up in its {:else}", async () => {
		const { page, attrs } = hydrating();
		await page.settle();
		expect(page.engine.state(page.byClass("background")).inlineStyles.get("opacity")).toBe("0.5");
		expect(attrs("outer")["else-cleaned"]).toBe("yes");
	});

	it("rejects a held call no background function takes over, and reports it", async () => {
		const { page, attrs } = hydrating();
		page.engine.dispatch(page.byClass("else"), { type: "tap" });
		await page.settle();
		expect(attrs("outer")["frame-only"]).toBe("first_frame_call_unanswered");
		expect(page.errors).toEqual([expect.objectContaining({ code: "first_frame_call_unanswered" })]);
	});
});
