// A UI method that reads the layout of the update it came with: `scrollTo` to the end of rows the
// same update added. Android measures a scroll view's content at the frame after the flush, and
// answers a scroll past what it measured with code 4, stopping at the old end; the method must run
// once the rows are measured. The responder here answers as Android does.

import { describe, expect, it } from "@rstest/core";

import ScrollRows from "../fixtures/threads/ScrollRows.svelte";
import { startSveltePage } from "./svelte-page.ts";

/** A row's height and the scroll view's, as the fixture's `scrollTo` counts them. */
const ROW = 40;
const VIEWPORT = 160;

async function scrollRows() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(ScrollRows, { props: () => ({ handles }) });
	await page.settle();
	/** Where each `scrollTo` stopped. */
	const stops: number[] = [];
	// Android's scrollTo (UIScrollView.scrollTo): its range is the content it last measured.
	page.engine.respondWith((method, params, _element, _shown, measured) => {
		if (method !== "scrollTo") return { code: 0 };
		const rows = (measured?.children ?? []).filter(
			(child) => page.engine.state(child).classes === "row",
		).length;
		const range = Math.max(rows * ROW - VIEWPORT, 0);
		const { offset } = params as { offset: number };
		if (offset <= range) {
			stops.push(offset);
			return { code: 0, data: "" };
		}
		stops.push(range);
		return {
			code: 4,
			data: `Target scroll position = ${offset} is beyond threshold. Clamped to position = ${range}`,
		};
	});
	const grow = async (waitTick: boolean) => {
		const answer = page.asBackground(() =>
			(handles["grow"] as (waitTick: boolean) => Promise<unknown>)(waitTick),
		);
		answer.catch(() => {});
		await page.settle();
		return answer;
	};
	return { page, stops, grow };
}

describe("scrollTo to the end of rows the same update added", () => {
	it.each([
		["in the same update", false],
		["after tick()", true],
	])("reaches the new end, called %s", async (_name, waitTick) => {
		const { page, stops, grow } = await scrollRows();
		await expect(grow(waitTick)).resolves.toBe("");
		expect(stops).toEqual([30 * ROW - VIEWPORT]);
		expect(page.errors).toEqual([]);
	});
});
