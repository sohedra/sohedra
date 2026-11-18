// Gestures as the UI library passes them: through spreads, a sheet's pan built again from the
// scroll views inside it, which it waits for so they scroll first, and a slider's built once.

import { describe, expect, it } from "@rstest/core";

import Sheet from "../../fixtures/threads/gestures/Sheet.svelte";
import drawSheet from "../../fixtures/threads/gestures/Sheet.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import type { SveltePage } from "../svelte-page.ts";
import { expectNoStrayDetectors } from "./detectors.ts";

async function sheet(firstFrame = false) {
	const log: unknown[] = [];
	const api: Record<string, (value?: string) => void> = {};
	const page = startFunctionsPage(Sheet, { draw: drawSheet, props: { log, api }, firstFrame });
	await page.settle();
	return { page, log, api };
}

const only = (page: SveltePage, token: string) => page.engine.detectors(page.byClass(token))[0]!;

describe("a gesture through a spread", () => {
	it("waits for the scrolling of the scroll views inside, which register after it", async () => {
		const { page } = await sheet();
		const scroll = only(page, "scroll-first");
		expect(scroll.type).toBe(2);
		expect(only(page, "sheet").relations).toMatchObject({ waitFor: [scroll.id] });
		expect(only(page, "slider")).toMatchObject({ type: 0, callbacks: [{ name: "onUpdate" }] });
		expect(page.errors).toEqual([]);
	});

	it("keeps a drag across a rebuild of its callbacks' captures, and is set again for a new scroll view", async () => {
		const { page, log, api } = await sheet();
		const sheetElement = page.byClass("sheet");
		const id = only(page, "sheet").id;
		const sets = () => page.engine.gestureCalls.filter((call) => call.element === sheetElement);
		const before = sets().length;
		page.engine.fireGesture(sheetElement, { id, callback: "onUpdate", params: { y: 10 } });
		await page.settle();
		page.asBackground(() => api["snap"]!("half"));
		await page.settle();
		page.engine.fireGesture(sheetElement, { id, callback: "onUpdate", params: { y: 20 } });
		await page.settle();
		expect(sets()).toHaveLength(before);
		expect(only(page, "sheet").state).toBe(1);
		expect(log).toEqual([
			["drag", "closed", 10],
			["drag", "half", 20],
		]);
		page.asBackground(() => api["second"]!());
		await page.settle();
		// What it waits for changed: its detector is set again, under its id.
		expect(only(page, "sheet")).toMatchObject({
			id,
			relations: { waitFor: [only(page, "scroll-first").id, only(page, "scroll-second").id] },
		});
		expectNoStrayDetectors(page, "after a scroll view came");
		expect(page.errors).toEqual([]);
	});

	it("works from the first frame, where what effects add to it comes at hydration", async () => {
		const log: unknown[] = [];
		const page = startFunctionsPage(Sheet, {
			draw: drawSheet,
			props: { log, api: {} },
			firstFrame: true,
		});
		const sheetElement = page.byClass("sheet");
		const scroll = only(page, "scroll-first");
		const id = only(page, "sheet").id;
		// The scroll views register in an effect, which the first frame does not run: the first
		// frame's pan waits for nothing, and the background's, which waits for them, sets it again.
		expect(only(page, "sheet").relations).toMatchObject({ waitFor: [] });
		await page.settle();
		expect(only(page, "sheet")).toMatchObject({ id, relations: { waitFor: [scroll.id] } });
		expect(page.byClass("sheet")).toBe(sheetElement);
		expect(page.errors).toEqual([]);
	});
});
