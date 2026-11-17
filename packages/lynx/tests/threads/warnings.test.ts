// What the background warns about in a development build, at Lynx's warning level, once per
// place, naming the component's file, line and column.

import { describe, expect, it } from "@rstest/core";

import ItemKey from "../fixtures/threads/ItemKey.svelte";
import Loose from "../fixtures/threads/Loose.svelte";
import { startSveltePage } from "./svelte-page.ts";

describe("a development warning", () => {
	it("for an item-key that is an object, naming where the list item is", async () => {
		const page = startSveltePage(ItemKey);
		await page.settle();
		expect(page.warnings).toEqual([
			expect.objectContaining({
				code: "list_item_key_object",
				message: expect.stringMatching(
					/^A <list-item> has an object as its item-key.*\n.*ItemKey\.svelte:7:\d+/,
				),
			}),
		]);
	});

	it("for text outside a text element, once for its place", async () => {
		const page = startSveltePage(Loose);
		await page.settle();
		expect(page.warnings).toEqual([
			expect.objectContaining({
				code: "text_outside_text",
				message: expect.stringMatching(
					/^The text "loose text" is inside <view>.*\n.*Loose\.svelte:1:0/,
				),
			}),
		]);
		expect(page.engine.texts()).toEqual([]);
	});
});
