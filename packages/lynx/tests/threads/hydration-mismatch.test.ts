// A first frame that differs from the page the background rendered, outside a Svelte block: the
// main thread refuses hydration before it changes anything, and asks the background to write the
// page again, with the ids it has. The background reports `hydration_mismatch` once, naming what
// differs and where; the first frame stays on the screen until the page written again replaces it,
// in one flush, and the page works.

import { describe, expect, it } from "@rstest/core";

import { ROOT_ID } from "../../src/wire/index.ts";
import type { Op } from "../../src/wire/index.ts";
import FrameCounter from "../fixtures/threads/FrameCounter.svelte";
import { startSveltePage } from "./svelte-page.ts";

const BUTTON = `<view class="button"><text class="label">Tap me</text></view>`;

/** The counter's first frame as `root` (the root view's tag and attributes) and `inside` draw it. */
function refused(markup: string) {
	const page = startSveltePage(FrameCounter, { firstFrame: () => markup });
	const drawn = page.engine.all();
	return { page, drawn };
}

const messages = (errors: unknown[]): string[] =>
	errors.map((error) => (error instanceof Error ? error.message : String(error)));

describe("a refused hydration", () => {
	it("reports an attribute that differs, with both values and its place", async () => {
		const { page } = refused(
			`<view class="root" style="padding: 8px;"><text class="count">Taps: 0 (even)</text>${BUTTON}</view>`,
		);
		await page.settle();
		expect(messages(page.errors)).toMatchSnapshot();
		expect((page.errors[0] as { code?: string }).code).toBe("hydration_mismatch");
	});

	it("writes the page again with the ids it has, and the frame stays until then", async () => {
		const { page, drawn } = refused(
			`<view class="root" style="padding: 8px;"><text class="count">Taps: 0 (even)</text>${BUTTON}</view>`,
		);
		const flushes = page.engine.flushes.length;
		await page.settle();
		const [first, again] = page.patches;
		expect(again!.items[0]).toEqual(["rewrite", ROOT_ID]);
		const made = (patch: typeof first) =>
			patch!.items
				.flatMap((item) => (item[0] === "ops" ? (item[1] as Op[]) : []))
				.filter((op) => op[0] === 1)
				.map((op) => op[1]);
		expect(made(again)).toEqual(made(first));
		// The refused patch is not flushed; the page written again is, once.
		expect(page.engine.flushes.length).toBe(flushes + 1);
		expect(page.engine.all().filter((element) => drawn.includes(element))).toEqual([drawn[0]]);
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
		expect(page.engine.state(page.byClass("root")).inlineStyles.get("padding")).toBe("24px");
	});

	it("leaves a page whose handlers work", async () => {
		const { page } = refused(`<text class="root">Taps: 0 (even)</text>`);
		await page.settle();
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 1 (odd)");
		expect(page.errors).toHaveLength(1);
	});

	it.each([
		["a tag that differs", `<text class="root">Taps: 0 (even)</text>`],
		[
			"an element the frame lacks",
			`<view class="root" style="padding: 24px;"><text class="count">Taps: 0 (even)</text></view>`,
		],
		[
			"an element the background lacks",
			`<view class="root" style="padding: 24px;"><text class="count">Taps: 0 (even)</text>${BUTTON}<view></view></view>`,
		],
		[
			"an element at the page's root the background lacks",
			`<view class="root" style="padding: 24px;"><text class="count">Taps: 0 (even)</text>${BUTTON}</view><view></view>`,
		],
		[
			"an attribute the background does not set",
			`<view class="root" style="padding: 24px;" hidden="yes"><text class="count">Taps: 0 (even)</text>${BUTTON}</view>`,
		],
	])("reports %s", async (_, markup) => {
		const { page } = refused(markup);
		await page.settle();
		expect(messages(page.errors)).toMatchSnapshot();
		expect(page.engine.texts()).toEqual(["Taps: 0 (even)", "Tap me"]);
	});

	it("tells the host of new data once, when the page written again shows it", async () => {
		const { page } = refused(`<text class="root">Taps: 0 (even)</text>`);
		const flushes = page.engine.flushes.length;
		page.updateData({ theme: "dark" });
		await page.settle();
		const flagged = page.engine.flushes
			.slice(flushes)
			.filter((options) => (options as { triggerDataUpdated?: boolean }).triggerDataUpdated);
		expect(flagged).toHaveLength(1);
	});

	it("drops the events the first frame heard", async () => {
		const { page } = refused(`<text class="root">Taps: 0 (even)</text>`);
		page.engine.dispatch(page.byClass("root"), { type: "tap" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Taps: 0 (even)");
	});
});
