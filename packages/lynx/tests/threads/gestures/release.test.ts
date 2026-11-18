// A gesture's detectors go with their element: a list row the main thread lets go of, a deferred
// row's contents, a row of the first screen, a part only the first frame draws, a part the page
// takes away, and the page itself. What goes is removed from the engine, and the page forgets it.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../../src/testing/globals.ts";
import GestureRows from "../../fixtures/threads/gestures/GestureRows.svelte";
import drawGestureRows from "../../fixtures/threads/gestures/GestureRows.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import { scroller, scrollThrough } from "../scroll.ts";
import { expectNoStrayDetectors, liveDetectors } from "./detectors.ts";

async function rows(
	options: {
		async?: boolean;
		defer?: boolean | { unmountRecycled?: boolean };
		initial?: number;
		firstFrame?: boolean;
	} = {},
) {
	const { firstFrame = false, ...props } = options;
	const api: Record<string, unknown> = {};
	const page = startFunctionsPage(GestureRows, {
		draw: drawGestureRows,
		props: { api, ...props },
		firstFrame,
	});
	await page.settle();
	const scroll = scroller(page.engine, page.byClass("list"));
	scroll.to(0);
	await page.settle();
	const through = (from: number, to: number) =>
		scrollThrough({ scroll, from, to, settle: page.settle });
	/** The rows whose elements are made: each holds one detector. */
	const made = () =>
		page.engine
			.all()
			.filter((element) => page.engine.state(element).classes.split(" ").includes("row")).length;
	/** Swipes the row `id` once. */
	const swipe = async (id: number) => {
		const row = page.byClass(`row-${id}`);
		const [detector] = page.engine.detectors(row);
		page.engine.fireGesture(row, { id: detector!.id, callback: "onUpdate", params: { x: 3 } });
		await page.settle();
		const moves = page.asBackground(() => (api["read"] as () => Promise<number>)());
		await page.settle();
		return moves;
	};
	return { page, through, made, swipe };
}

describe("a row's gesture", () => {
	it("is removed with the row the main thread lets go of, and set again when it comes back", async () => {
		const { page, through, made, swipe } = await rows();
		expect(liveDetectors(page)).toBe(made());
		await through(0, 31);
		expectNoStrayDetectors(page, "scrolled away");
		expect(liveDetectors(page)).toBe(made());
		expect(page.engine.gestureCalls.filter((call) => call.op === "remove").length).toBeGreaterThan(
			10,
		);
		await through(31, 0);
		expectNoStrayDetectors(page, "scrolled back");
		expect(await swipe(1)).toBe(1);
		expect(page.errors).toEqual([]);
	});

	it("of a deferred row is set once its contents come, and goes with them", async () => {
		const { page, through, made, swipe } = await rows({ async: true, defer: true });
		expect(liveDetectors(page)).toBe(made());
		await through(0, 31);
		expectNoStrayDetectors(page, "scrolled away");
		await through(31, 0);
		expectNoStrayDetectors(page, "scrolled back");
		expect(await swipe(2)).toBe(1);
		expect(page.errors).toEqual([]);
	});

	it("of a deferred row goes with its contents, with unmountRecycled", async () => {
		const { page, through } = await rows({ async: true, defer: { unmountRecycled: true } });
		await through(0, 31);
		expectNoStrayDetectors(page, "scrolled away");
		await through(31, 0);
		expectNoStrayDetectors(page, "scrolled back");
		expect(page.errors).toEqual([]);
	});

	it("of a row of the first screen is set from the first frame, and not again at hydration", async () => {
		const { page, made, through } = await rows({
			async: true,
			defer: true,
			initial: 9,
			firstFrame: true,
		});
		const sets = page.engine.gestureCalls.filter((call) => call.op === "set");
		// Each row's detector was set once, by the first frame or as its contents came, and none
		// was removed or set again at hydration.
		expect(new Set(sets.map((call) => call.element)).size).toBe(sets.length);
		expect(sets.length).toBe(made());
		expect(page.engine.gestureCalls.filter((call) => call.op === "remove")).toEqual([]);
		await through(0, 31);
		expectNoStrayDetectors(page, "scrolled away");
		expect(page.errors).toEqual([]);
	});
});

describe("rows with gestures released and made again many times", () => {
	it("leave the page's tables as they were after the first round", async () => {
		const { page, through, made } = await rows();
		const round = async () => {
			await through(0, 37);
			await through(37, 0);
			return { ...page.runtime.page.functions.sizes(), live: liveDetectors(page), made: made() };
		};
		const first = await round();
		for (let index = 0; index < 6; index++)
			expect(await round(), `round ${index + 2}`).toEqual(first);
		expect(first.detectors).toBe(first.made);
		expect(page.errors).toEqual([]);
	});

	it("leave nothing in the callbacks the engine had: a removed detector's entry runs nothing", async () => {
		const { page, through } = await rows();
		const row = page.byClass("row-1");
		const [detector] = page.engine.detectors(row);
		const entry = detector!.callbacks[0]!.callback as {
			manager?: unknown;
			fn: { _wkltId: string };
		};
		expect(entry.manager).toBeDefined();
		await through(0, 37);
		// Row 1 was released: its detector's entry let go of its function and of the state manager,
		// which holds the element.
		expect(page.engine.detectors(row)).toEqual([]);
		expect(entry.manager).toBeUndefined();
		const run = readGlobal("runWorklet") as (
			value: unknown,
			params: unknown[],
			options: unknown,
		) => unknown;
		expect(page.asMainThread(() => run(entry, [{}, {}], { source: 2 }))).toBeUndefined();
		expect(page.errors).toEqual([]);
	});
});
