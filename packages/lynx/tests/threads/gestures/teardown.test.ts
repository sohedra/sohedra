// A gesture's detectors go with their element when a part of the page goes: a part only the first
// frame draws, a part the page takes away, a first frame hydration cannot keep, and the page
// itself, at its end or a reload. The page holds no gesture of what went.

import { describe, expect, it } from "@rstest/core";

import Teardown from "../../fixtures/threads/gestures/Teardown.svelte";
import drawTeardown from "../../fixtures/threads/gestures/Teardown.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import type { SveltePage } from "../svelte-page.ts";
import { expectNoStrayDetectors, liveDetectors } from "./detectors.ts";

function teardown(options: { firstFrame?: boolean; refuse?: boolean } = {}) {
	const { firstFrame = true, refuse = false } = options;
	const api: Record<string, () => void> = {};
	const page = startFunctionsPage(Teardown, {
		draw: drawTeardown,
		props: { api, refuse },
		firstFrame,
	});
	return { page, api };
}

const sizes = (page: SveltePage) => page.runtime.page.functions.sizes();

describe("a gesture of a part that goes", () => {
	it("of the first frame only is removed at hydration, and the background's part gets its own", async () => {
		const { page } = teardown();
		const early = page.byClass("early");
		expect(page.engine.detectors(early)).toHaveLength(1);
		await page.settle();
		expect(page.engine.detectors(early)).toEqual([]);
		expect(page.engine.detectors(page.byClass("late"))).toHaveLength(1);
		expectNoStrayDetectors(page, "after hydration");
		expect(page.errors).toEqual([]);
	});

	it("is removed with a part the page takes away", async () => {
		const { page, api } = teardown();
		await page.settle();
		const inner = page.byClass("inner");
		page.asBackground(() => api["hide"]!());
		await page.settle();
		expect(page.engine.detectors(inner)).toEqual([]);
		expectNoStrayDetectors(page, "after the part went");
		expect(sizes(page)).toMatchObject({ detectors: 1, gestureIds: 1 });
	});

	it("of a first frame hydration cannot keep goes, and the page written again sets its own", async () => {
		const { page } = teardown({ refuse: true });
		const drawn = [page.byClass("early"), page.byClass("inner")];
		await page.settle();
		expect(page.errors).toEqual([expect.objectContaining({ code: "hydration_mismatch" })]);
		for (const element of drawn) expect(page.engine.detectors(element)).toEqual([]);
		expect(page.engine.detectors(page.byClass("late"))).toHaveLength(1);
		expectNoStrayDetectors(page, "after the page was written again");
	});
});

describe("the page's gestures", () => {
	it("go when the page ends", async () => {
		const { page } = teardown();
		await page.settle();
		expect(liveDetectors(page)).toBe(2);
		page.destroy();
		await page.settle();
		expect(liveDetectors(page)).toBe(0);
		expect(sizes(page)).toMatchObject({ detectors: 0, gestureIds: 0 });
	});

	it("go at a reload, and the page that follows counts its own ids from the start", async () => {
		const { page } = teardown({ firstFrame: false });
		await page.settle();
		const before = page.byClass("late");
		const first = page.engine.detectors(before)[0]!.id;
		page.reload();
		await page.settle();
		expect(page.engine.detectors(before)).toEqual([]);
		expect(page.engine.detectors(page.byClass("late"))[0]!.id).toBe(first);
		expectNoStrayDetectors(page, "after the reload");
		expect(page.errors).toEqual([]);
	});
});
