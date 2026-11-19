// An element with a spread and an empty class (`<view {...rest} class={tone}>`, `tone` ""): Svelte's
// server writes `class=""`, and its client, setting the spread's attributes, sets no class. An
// empty class is no class to Lynx, so hydration takes the two as the same.

import { expect, it } from "@rstest/core";

import EmptyClassSpread from "../../fixtures/threads/EmptyClassSpread.svelte";
import drawEmptyClassSpread from "../../fixtures/threads/EmptyClassSpread.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

it("hydrates an element with a spread and an empty class", async () => {
	const page = startSveltePage(EmptyClassSpread, {
		props: () => ({ tone: "" }),
		firstFrame: { draw: drawEmptyClassSpread, props: { tone: "" } },
	});
	const drawn = page.engine.all();
	await page.settle();
	expect(page.errors).toEqual([]);
	expect(page.engine.all()).toEqual(drawn);
});
