// A change Lynx refuses on the main thread is reported into Lynx with what the main thread was
// doing, in the developer's terms (a development build, which tests are); the rest of the patch is
// applied, and the tree flushed once.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../src/testing/globals.ts";
import { encodePatch, OpCode, PATCH_METHOD } from "../../src/wire/index.ts";
import type { Op } from "../../src/wire/index.ts";
import Counter from "../fixtures/threads/Counter.svelte";
import { startSveltePage } from "./svelte-page.ts";

describe("a change Lynx refuses", () => {
	it("is reported with what it was, and the changes after it are applied and flushed", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const ops = page.patches[0]!.items.flatMap((item) => (item[0] === "ops" ? item[1] : []));
		const texts = ops.filter((op) => op[0] === OpCode.CreateText).map((op) => op[1]);
		const flushes = page.engine.flushes.length;
		const refused: Op[] = [
			[OpCode.SetText, texts[0]!, "first"],
			[OpCode.Insert, 7000, 7001, 0],
			[OpCode.SetText, texts[1]!, "after"],
		];
		// What Lynx does with a patch: it calls the main thread's patch function.
		const patch = readGlobal(PATCH_METHOD) as (params: { data: string }) => void;
		page.asMainThread(() => patch(encodePatch({ generation: 0, items: [["ops", refused]] })));
		expect(page.engine.texts()).toEqual(["first", "after"]);
		expect(page.engine.flushes.length).toBe(flushes + 1);
		expect(page.errors).toEqual([
			expect.objectContaining({
				code: "change_not_applied",
				message: expect.stringMatching(
					/^A change to the page could not be applied on the main thread: .*7000.*\nWhile trying to insert element 7001 into element 7000\./,
				),
			}),
		]);
	});
});
