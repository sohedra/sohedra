// A reload draws no first frame: every deferred row of the new page waits until Lynx asks for it,
// the rows of the old page's first screen too, and comes when Lynx does. The row's `{#if}` must
// subscribe to the row's state as the row renders, whether or not the page is starting.

import { expect, it } from "@rstest/core";

import FirstScreen from "../../fixtures/threads/FirstScreen.svelte";
import drawFirstScreen from "../../fixtures/threads/FirstScreen.svelte?first-frame";
import { expectInSyncOnceAsked } from "../released-rows.ts";
import { startSveltePage } from "../svelte-page.ts";

it("renders a row of the first screen when Lynx asks for it after a reload", async () => {
	let handles: Record<string, unknown> = {};
	const page = startSveltePage(FirstScreen, {
		props: () => ({ handles: (handles = {}) }),
		firstFrame: { draw: drawFirstScreen, props: { handles: {} } },
	});
	await page.settle();
	page.reload();
	await page.settle();
	expect(handles["rendered"]).toEqual([]);
	const list = page.engine.list(page.byClass("list"));
	expect(list.ask(0)).toBeUndefined();
	const operation = list.operation;
	await page.settle();
	expect(page.engine.text(list.given(operation)!)).toBe("Row 1: 0");
	await expectInSyncOnceAsked("after the reload", page);
	expect(page.errors).toEqual([]);
});
