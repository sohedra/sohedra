// Goldens of the patches a real page sends, beside the wire's hand-made ones: a change in what the
// renderer and the channel write shows here first.

import { describe, expect, it } from "@rstest/core";

import Counter from "../fixtures/threads/Counter.svelte";
import { startSveltePage } from "./svelte-page.ts";

describe("the patches of a counter page", () => {
	it("are its first render, a tap, new data and a reload", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		page.engine.dispatch(page.byClass("button"), { type: "tap" });
		await page.settle();
		page.updateData({ theme: "dark" });
		await page.settle();
		page.reload();
		await page.settle();
		expect(page.patches.map((patch) => JSON.stringify(patch))).toMatchSnapshot();
	});
});
