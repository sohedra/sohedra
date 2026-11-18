// A gesture's id stays with its element: Android registers an element's detector ids once, so an
// element keeps the ids it had while it lives. A new gesture takes its element's id before any
// element made in the same batch gets one; a gesture that only relations knew takes its element's
// id when it lands there, and what names it is set again; a gesture turned off and on again gets
// its id back.

import { describe, expect, it } from "@rstest/core";

import Collide from "../../fixtures/threads/gestures/Collide.svelte";
import drawCollide from "../../fixtures/threads/gestures/Collide.svelte?first-frame";
import Later from "../../fixtures/threads/gestures/Later.svelte";
import drawLater from "../../fixtures/threads/gestures/Later.svelte?first-frame";
import Shared from "../../fixtures/threads/gestures/Shared.svelte";
import drawShared from "../../fixtures/threads/gestures/Shared.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import type { SveltePage } from "../svelte-page.ts";
import { expectNoStrayDetectors } from "./detectors.ts";

const callsOf = (page: SveltePage, element: object) =>
	page.engine.gestureCalls
		.filter((call) => call.element === element)
		.map((call) => `${call.op} ${call.id}`);
const only = (page: SveltePage, token: string) => page.engine.detectors(page.byClass(token))[0]!;

describe("a gesture's id", () => {
	it("stays on a kept element at hydration, though a part made before it shares the gesture", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Shared, {
			draw: drawShared,
			props: { api },
			firstFrame: true,
		});
		const kept = page.byClass("kept");
		const waits = page.byClass("waits");
		const id = only(page, "kept").id;
		const drawn = { kept: callsOf(page, kept), waits: callsOf(page, waits) };
		await page.settle();
		expect(page.byClass("kept")).toBe(kept);
		// Nothing set again: the made part shares the kept element's id, and the tap names it still.
		expect(callsOf(page, kept)).toEqual(drawn.kept);
		expect(callsOf(page, waits)).toEqual(drawn.waits);
		expect(callsOf(page, page.byClass("late"))).toEqual([`set ${id}`]);
		expect(only(page, "waits").relations).toMatchObject({ waitFor: [id] });
		expect(page.errors).toEqual([]);
	});

	it("is set again under the same id at hydration when the background's options differ", async () => {
		const page = startFunctionsPage(Shared, {
			draw: drawShared,
			props: { api: {} },
			firstFrame: true,
		});
		const differs = page.byClass("differs");
		const id = only(page, "differs").id;
		await page.settle();
		expect(callsOf(page, differs)).toEqual([`set ${id}`, `set ${id}`]);
		expect(only(page, "differs").config).toEqual({ minDistance: 4 });
	});

	it("stays on the old rows when a row comes in the flush that builds their gesture again", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Shared, { draw: drawShared, props: { api } });
		await page.settle();
		const rows = [page.byClass("row-1"), page.byClass("row-2")];
		const id = only(page, "row-1").id;
		const before = rows.map((row) => callsOf(page, row));
		page.asBackground(() => api["add"]!());
		await page.settle();
		expect(rows.map((row) => callsOf(page, row))).toEqual(before);
		expect(only(page, "row-0").id).toBe(id);
		expectNoStrayDetectors(page, "after a row came");
		expect(page.errors).toEqual([]);
	});

	it("is its element's once it lands there, after a relation named it, and its namer is set again", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Later, { draw: drawLater, props: { api } });
		await page.settle();
		const scroll = page.byClass("scroll");
		const id = only(page, "scroll").id;
		page.asBackground(() => api["name"]!());
		await page.settle();
		page.asBackground(() => api["show"]!());
		await page.settle();
		// The same detector as before: nothing set on the scroll view, and the sheet names its id.
		expect(only(page, "scroll").id).toBe(id);
		expect(callsOf(page, scroll)).toEqual([`set ${id}`]);
		expect(only(page, "sheet").relations).toMatchObject({ waitFor: [id] });
		// The sheet's, the scroll view's and the toggled pan's: the old scroll gesture's id is let go of.
		expect(page.runtime.page.functions.sizes().gestureIds).toBe(3);
		expectNoStrayDetectors(page, "after the scroll view got its gesture");
		expect(page.errors).toEqual([]);
	});

	it("comes back with a gesture turned off and on again", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Later, { draw: drawLater, props: { api } });
		await page.settle();
		const toggled = page.byClass("toggled");
		const id = only(page, "toggled").id;
		page.asBackground(() => api["toggle"]!());
		await page.settle();
		expect(page.engine.detectors(toggled)).toEqual([]);
		page.asBackground(() => api["toggle"]!());
		await page.settle();
		expect(callsOf(page, toggled)).toEqual([`set ${id}`, `remove ${id}`, `set ${id}`]);
		expectNoStrayDetectors(page, "after the gesture came back");
	});

	it("stays with its element when its gesture moves to an element made in the same patch", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Collide, { draw: drawCollide, props: { api } });
		await page.settle();
		const b = page.byClass("b");
		const id = only(page, "b").id;
		page.asBackground(() => api["flip"]!());
		await page.settle();
		// The pan moved to the new element, which gets a new id; the old element keeps its own.
		expect(only(page, "b")).toMatchObject({ id, type: 3 });
		expect(only(page, "a").id).not.toBe(id);
		page.asBackground(() => api["rebuildTap"]!());
		await page.settle();
		expect(callsOf(page, b).slice(-1)).toEqual([`set ${id}`]);
		expect(only(page, "b").id).toBe(id);
		expectNoStrayDetectors(page, "after the flip");
		expect(page.errors).toEqual([]);
	});

	it("stays with each element when two elements swap their gestures, and what names one follows it", async () => {
		const api: Record<string, () => void> = {};
		const page = startFunctionsPage(Collide, { draw: drawCollide, props: { api } });
		await page.settle();
		const [x, y] = [only(page, "x").id, only(page, "y").id];
		expect(only(page, "t").relations).toMatchObject({ waitFor: [x] });
		page.asBackground(() => api["swap"]!());
		await page.settle();
		expect([only(page, "x").id, only(page, "y").id]).toEqual([x, y]);
		expect(only(page, "t").relations).toMatchObject({ waitFor: [y] });
		page.asBackground(() => api["swap"]!());
		await page.settle();
		expect([only(page, "x").id, only(page, "y").id]).toEqual([x, y]);
		expect(only(page, "t").relations).toMatchObject({ waitFor: [x] });
		expectNoStrayDetectors(page, "after the swaps");
		expect(page.errors).toEqual([]);
	});
});
