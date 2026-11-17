// Texts never refuse hydration: a text the background rendered and the first frame lacks (Svelte's
// server writes nothing for an empty one) is made in place, and one the frame drew that the
// background lacks is taken off. A mismatch is named by an element, never by a text.

import { describe, expect, it } from "@rstest/core";

import FrameTexts from "../fixtures/threads/FrameTexts.svelte";
import drawFrameTexts from "../fixtures/threads/FrameTexts.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

function drawnTexts(props: Record<string, unknown>, drawnProps = props) {
	const page = startSveltePage(FrameTexts, {
		props: () => props,
		firstFrame: { draw: drawFrameTexts, props: drawnProps },
	});
	return { page, drawn: page.engine.all() };
}

describe("texts in hydration", () => {
	it("adopt the page when a text is empty, with one flush", async () => {
		const { page, drawn } = drawnTexts({ message: "" });
		const flushes = page.engine.flushes.length;
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.flushes.length).toBe(flushes + 1);
		for (const element of drawn) expect(page.engine.all()).toContain(element);
		expect(page.engine.text(page.byClass("message"))).toBe("");
		expect(page.patches).toHaveLength(1);
	});

	it("adopt the elements around an empty text beside an inline <text>", async () => {
		const { page, drawn } = drawnTexts({ before: "", after: "end" });
		await page.settle();
		expect(page.errors).toEqual([]);
		for (const element of drawn) expect(page.engine.all()).toContain(element);
		expect(page.engine.text(page.byClass("mixed"))).toBe("inlineend");
	});

	it("make a text the frame lacks, and take off one the background lacks", async () => {
		const { page } = drawnTexts({ before: "start", after: "" }, { before: "", after: "end" });
		const inline = page.byClass("inline");
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.byClass("inline")).toBe(inline);
		expect(page.engine.text(page.byClass("mixed"))).toBe("startinline");
	});

	it("name a mismatch by an element, with its place", async () => {
		const page = startSveltePage(FrameTexts, {
			firstFrame: () =>
				`<view class="root"><text class="message"></text><text class="mixed"><view class="inline"></view>end</text><view class="after"><text>after</text></view></view>`,
		});
		await page.settle();
		const [error] = page.errors as Error[];
		expect(error!.message).toContain(
			"the background rendered a <text> where the first frame has a <view>",
		);
		expect(error!.message).toContain("tests/fixtures/threads/FrameTexts.svelte:");
		expect(error!.message).not.toContain("#text");
	});
});
