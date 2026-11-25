// Main-thread functions from the first frame on. The first frame runs its own copies; hydration
// hands each element's to the background's copies on the same element, with the refs the first
// frame's left and the calls of background functions it held, which go out in order with the
// events the first frame heard. A function ref the first frame ran is not run again, unless what
// it captured differs on the background.

import { describe, expect, it } from "@rstest/core";

import { keptContexts } from "../../../src/background/functions/calls.ts";
import Adopted from "../../fixtures/threads/functions/Adopted.svelte";
import drawAdopted from "../../fixtures/threads/functions/Adopted.svelte?first-frame";
import BackgroundLast from "../../fixtures/threads/functions/BackgroundLast.svelte";
import drawBackgroundLast from "../../fixtures/threads/functions/BackgroundLast.svelte?first-frame";
import BackgroundLastBound from "../../fixtures/threads/functions/BackgroundLastBound.svelte";
import drawBackgroundLastBound from "../../fixtures/threads/functions/BackgroundLastBound.svelte?first-frame";
import BackgroundLastSame from "../../fixtures/threads/functions/BackgroundLastSame.svelte";
import drawBackgroundLastSame from "../../fixtures/threads/functions/BackgroundLastSame.svelte?first-frame";
import Hydrate from "../../fixtures/threads/functions/Hydrate.svelte";
import drawHydrate from "../../fixtures/threads/functions/Hydrate.svelte?first-frame";
import Refused from "../../fixtures/threads/functions/Refused.svelte";
import drawRefused from "../../fixtures/threads/functions/Refused.svelte?first-frame";
import { expectAccounted } from "./accounting.ts";
import { startFunctionsPage, tap } from "./pages.ts";
import type { Draw } from "./pages.ts";

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
		// The call a function ref the first patch made makes waits in the same log, after them.
		expect(log).toEqual([["once"], ["bump", 1], ["plain"], ["bump", 2], ["late"]]);
		expect(page.errors).toEqual([]);
	});

	it("runs on a tap while the first patch waits for the paint, and its calls follow it in order", async () => {
		const { page, log, attrs } = hydrating();
		const frames = page.engine.holdFrames();
		await page.settle();
		expect(page.patches).toHaveLength(1);
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		page.engine.dispatch(page.byClass("plain"), { type: "tap" });
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		expect(log).toEqual([]);
		expect(attrs("where")["ran-in"]).toBe("frame");
		frames();
		await page.settle();
		expect(log).toEqual([["once"], ["bump", 1], ["plain"], ["bump", 2], ["late"]]);
		expect(attrs("where")["ran-in"]).toBe("background");
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

	it("rejects held calls no background function takes over, and reports them once, counted", async () => {
		const { page, attrs } = hydrating();
		page.engine.dispatch(page.byClass("else"), { type: "tap" });
		page.engine.dispatch(page.byClass("else"), { type: "tap" });
		await page.settle();
		expect(attrs("outer")["frame-only"]).toBe("first_frame_call_unanswered");
		expect(page.errors).toEqual([
			expect.objectContaining({
				code: "first_frame_call_unanswered",
				message: expect.stringMatching(/so it has no answer \(2 calls\)\.\n/),
			}),
		]);
	});

	it("lets go at hydration of what only the first frame bound on an element it keeps", async () => {
		const { page } = hydrating();
		const element = page.byClass("frame-only");
		expect(page.engine.state(element).mainThreadEvents).toHaveLength(1);
		await page.settle();
		expect(page.byClass("frame-only")).toBe(element);
		expect(page.engine.state(element).mainThreadEvents).toEqual([]);
	});

	it("sends the held calls even when the first patch's flush throws, and the next calls at once", async () => {
		const { page, log } = hydrating();
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		const functions = page.engine.functions as unknown as Record<
			string,
			(...args: unknown[]) => unknown
		>;
		const flush = functions["__FlushElementTree"]!;
		let thrown = false;
		functions["__FlushElementTree"] = (...args) => {
			if (!thrown && args.length > 0) {
				thrown = true;
				throw new Error("The flush failed.");
			}
			return flush(...args);
		};
		await page.settle();
		functions["__FlushElementTree"] = flush;
		expect(thrown).toBe(true);
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(
			expect.arrayContaining([
				["bump", 1],
				["bump", 2],
			]),
		);
		expect(page.errors).toEqual([expect.objectContaining({ message: "The flush failed." })]);
	});
});

describe("a first frame the background cannot hydrate", () => {
	it("is written again, its held calls reject unreported, and its functions go on", async () => {
		const log: unknown[][] = [];
		const api: Record<string, () => Promise<unknown>> = {};
		const page = startFunctionsPage(Refused, {
			draw: drawRefused,
			props: { log, api },
			firstFrame: true,
		});
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		await page.settle();
		// Hydration says why: the calls it could not answer add nothing.
		expect(page.errors).toEqual([expect.objectContaining({ code: "hydration_mismatch" })]);
		// The first frame's tap was not answered, and the page written again made its function ref run.
		expect(log).toEqual([["attached"]]);
		await tap(page, "tap");
		expect(log.at(-1)).toEqual(["tap", expect.any(Number)]);
		// The background dropped what the main thread had of the page before: both agree.
		expectAccounted(page, "after the page was written again");
		const kept = new Set(page.asBackground(keptContexts));
		expect(page.runtime.page.functions.sizes().contexts.filter((id) => !kept.has(id))).toEqual([]);
	});
});

describe("a main-thread handler in the other branch of {#if background}", () => {
	function adopting() {
		const log: unknown[][] = [];
		const page = startFunctionsPage(Adopted, {
			draw: drawAdopted,
			props: { log },
			firstFrame: true,
		});
		return { page, log };
	}

	// The two branches look the same, and hydration pairs by the branch each took: the element is
	// made again, never taken as the other branch's.
	it.each(["same", "differs"])(
		"has its held call rejected, and its element made again, when the function is %s",
		async (token) => {
			const { page, log } = adopting();
			const element = page.byClass(token);
			page.engine.dispatch(element, { type: "tap" });
			await page.settle();
			expect(page.byClass(token)).not.toBe(element);
			expect(log).toEqual([]);
			// Its catch writes to the drawn element, which the page let go of.
			expect(page.errors).toEqual([
				expect.objectContaining({ code: "first_frame_call_unanswered" }),
				expect.objectContaining({ code: "element_released" }),
			]);
		},
	);
});

describe("a main-thread handler in a block beside a part only the background renders", () => {
	/** Taps the first frame's `.tapped`, and lets hydration happen. */
	async function tappedEarly(App: Parameters<typeof startFunctionsPage>[0], draw: Draw) {
		const log: unknown[][] = [];
		const page = startFunctionsPage(App, {
			draw,
			props: { log },
			firstFrame: true,
		});
		const element = page.byClass("tapped");
		page.engine.dispatch(element, { type: "tap" });
		await page.settle();
		return { page, log, element };
	}

	it("has its held call answered by its own element's function, its element kept", async () => {
		const { page, log, element } = await tappedEarly(BackgroundLast, drawBackgroundLast);
		expect(page.byClass("tapped")).toBe(element);
		expect(log).toEqual([["tapped"]]);
		expect(page.engine.state(element).attrs["refused"]).toBeUndefined();
		expect(page.errors).toEqual([]);
		await tap(page, "tapped");
		expect(log).toEqual([["tapped"], ["tapped"]]);
	});

	it("has its held call answered once, not by the part only the background renders", async () => {
		const { page, log } = await tappedEarly(BackgroundLastSame, drawBackgroundLastSame);
		expect(log).toEqual([["tapped"]]);
		expect(page.errors).toEqual([]);
		await tap(page, "tapped");
		await tap(page, "later");
		expect(log).toEqual([["tapped"], ["tapped"], ["tapped"]]);
	});

	it("has its held call answered when the part only the background renders binds a ref", async () => {
		const { page, log } = await tappedEarly(BackgroundLastBound, drawBackgroundLastBound);
		expect(log).toEqual([["tapped"]]);
		expect(page.errors).toEqual([]);
		await tap(page, "tapped");
		expect(log).toEqual([["tapped"], ["tapped"]]);
	});
});
