// Relations name detectors by the ids Lynx knows them by, which the page gives out: a relation may
// name a gesture set later in the same patch, and a gesture keeps its id when it is built again,
// since Android registers an element's detector ids only once.

import { describe, expect, it } from "@rstest/core";

import Relations from "../../fixtures/threads/gestures/Relations.svelte";
import drawRelations from "../../fixtures/threads/gestures/Relations.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import type { SveltePage } from "../svelte-page.ts";

async function relations(firstFrame = false) {
	const api: Record<string, () => void> = {};
	const page = startFunctionsPage(Relations, { draw: drawRelations, props: { api }, firstFrame });
	await page.settle();
	return { page, api };
}

const detectors = (page: SveltePage, token: string) => page.engine.detectors(page.byClass(token));
const only = (page: SveltePage, token: string) => detectors(page, token)[0]!;

describe("relations", () => {
	it("name a gesture set later in the same patch by the id Lynx knows it by", async () => {
		const { page } = await relations();
		const outer = only(page, "outer").id;
		expect(only(page, "inner").id).not.toBe(outer);
		expect(only(page, "inner").relations).toEqual({
			waitFor: [outer],
			simultaneous: [],
			continueWith: [],
		});
		// One gesture on two elements: one id.
		expect(only(page, "shared").id).toBe(outer);
		expect(page.errors).toEqual([]);
	});

	it("keep naming a gesture built again: it keeps its id, and is set again only where it changed", async () => {
		const { page, api } = await relations();
		const [outer, inner, sheet] = ["outer", "inner", "sheet"].map((token) => only(page, token).id);
		const before = page.engine.gestureCalls.length;
		page.asBackground(() => api["far"]!());
		await page.settle();
		const after = (token: string) =>
			page.engine.gestureCalls
				.slice(before)
				.filter((call) => call.element === page.byClass(token))
				.map((call) => `${call.op} ${call.id}`);
		// The pans' distance changed: each is set again. The tap's relation names the same id: it stays.
		expect(after("outer")).toEqual([`set ${outer}`]);
		expect(after("shared")).toEqual([`set ${outer}`]);
		expect(after("sheet")).toEqual([`set ${sheet}`]);
		expect(after("inner")).toEqual([]);
		expect(only(page, "inner")).toMatchObject({ id: inner, relations: { waitFor: [outer] } });
		expect(only(page, "shared").id).toBe(outer);
	});

	it("stay with the other elements when one with the same gesture goes", async () => {
		const { page, api } = await relations();
		const outer = only(page, "outer").id;
		page.asBackground(() => api["toggle"]!());
		await page.settle();
		page.asBackground(() => api["far"]!());
		await page.settle();
		expect(only(page, "outer")).toMatchObject({ id: outer, config: { minDistance: 1 } });
		expect(only(page, "inner")).toMatchObject({ relations: { waitFor: [outer] } });
		page.asBackground(() => api["toggle"]!());
		await page.settle();
		expect(only(page, "shared").id).toBe(outer);
		expect(page.errors).toEqual([]);
	});

	it("let a pan wait for the scrolling of a scroll-view inside it, set after it", async () => {
		const { page } = await relations();
		const scroll = only(page, "scroll");
		expect(scroll).toMatchObject({ type: 2, config: { tapSlop: 3 }, callbacks: [] });
		expect(only(page, "sheet").relations).toEqual({
			waitFor: [scroll.id],
			simultaneous: [],
			continueWith: [],
		});
	});

	it("run a gesture with others named by simultaneousWith, on another element", async () => {
		const { page } = await relations();
		expect(only(page, "right").relations).toEqual({
			waitFor: [],
			simultaneous: [only(page, "left").id],
			continueWith: [],
		});
		expect(only(page, "left").relations).toMatchObject({ simultaneous: [] });
	});

	it("of a composition make each member wait for those before it", async () => {
		const { page } = await relations();
		const [pan, tap, press] = detectors(page, "three");
		expect([pan!.type, tap!.type, press!.type]).toEqual([0, 3, 4]);
		expect([pan, tap, press].map((detector) => detector!.relations)).toEqual([
			{ waitFor: [], simultaneous: [], continueWith: [] },
			{ waitFor: [pan!.id], simultaneous: [], continueWith: [] },
			{ waitFor: [pan!.id, tap!.id], simultaneous: [], continueWith: [] },
		]);
	});

	it("are the same from the first frame, and hydration sets nothing again", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Relations, {
			draw: drawRelations,
			props: { api },
			firstFrame: true,
		});
		const drawn = page.engine.gestureCalls.length;
		const outer = only(page, "outer").id;
		expect(only(page, "inner").relations).toMatchObject({ waitFor: [outer] });
		await page.settle();
		expect(page.engine.gestureCalls.length).toBe(drawn);
		page.asBackground(() => api["far"]!());
		await page.settle();
		expect(only(page, "outer")).toMatchObject({ id: outer, config: { minDistance: 1 } });
		expect(only(page, "inner")).toMatchObject({ relations: { waitFor: [outer] } });
		expect(page.errors).toEqual([]);
	});
});
