// A typed value that holds markup, `<list-item>` and `</list>`, on a cell of a list: the first frame
// writes it escaped, so the list's cells read back whole and are hydrated.

import { expect, it } from "@rstest/core";

import FrameMarkupValue from "../../fixtures/threads/FrameMarkupValue.svelte";
import drawFrameMarkupValue from "../../fixtures/threads/FrameMarkupValue.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

it("draws every cell, and hydrates the one Lynx holds", async () => {
	const page = startSveltePage(FrameMarkupValue, { firstFrame: { draw: drawFrameMarkupValue } });
	expect(page.errors).toEqual([]);
	const list = () => page.engine.list(page.byClass("list"));
	const first = list().show(0);
	expect(page.engine.state(first).dataset).toEqual({
		raw: { markup: "<list-item>a</list-item></list>" },
	});
	await page.settle();
	expect(page.errors).toEqual([]);
	expect(list().show(0)).toBe(first);
	expect(page.engine.text(list().show(1))).toBe("b");
});
