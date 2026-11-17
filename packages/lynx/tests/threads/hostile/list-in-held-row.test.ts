// A list inside a list row that Lynx holds at hydration (a feed whose first visible row holds a
// horizontal list): the inner list keeps its cells and its callbacks under the background's ids,
// shows the cells it had not shown, and hears of its new items.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../../src/testing/index.ts";
import FrameFeed from "../../fixtures/threads/FrameFeed.svelte";
import drawFrameFeed from "../../fixtures/threads/FrameFeed.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

describe("a list in a cell Lynx holds at hydration", () => {
	it("keeps its cells and its callbacks, and hears of its new items", async () => {
		const handles: Record<string, unknown> = {};
		const page = startSveltePage(FrameFeed, {
			props: () => ({ handles }),
			firstFrame: { draw: drawFrameFeed },
		});
		const row = page.engine.list(page.byClass("feed")).show(0);
		const carousel = () => page.engine.list(page.byClass("carousel"));
		const first = carousel().show(0);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.list(page.byClass("feed")).show(0)).toBe(row);
		expect(carousel().show(0)).toBe(first);
		expect(page.engine.text(carousel().show(1))).toBe("two");
		const feed = handles["feed"] as { rows: { cards: string[] }[]; tapped: string };
		page.asBackground(() => feed.rows[0]!.cards.push("three"));
		await page.settle();
		expect(
			carousel()
				.updates.at(-1)!
				.insertAction.map((item) => item["item-key"]),
		).toEqual(["three"]);
		const third = carousel().show(2);
		expect(page.engine.text(third)).toBe("three");
		page.engine.dispatch(first.firstChild as LynxElement, { type: "tap" });
		await page.settle();
		expect(feed.tapped).toBe("one");
		expect(page.errors).toEqual([]);
	});
});
