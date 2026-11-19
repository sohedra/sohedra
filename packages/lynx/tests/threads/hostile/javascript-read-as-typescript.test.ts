// A rune module written in JavaScript with `a < b > (c)`, which JavaScript reads as two comparisons
// and TypeScript as a call of `a` with a type argument: it keeps its JavaScript meaning.

import { describe, expect, it } from "@rstest/core";

import Compare from "../../fixtures/threads/Compare.svelte";
import { startSveltePage } from "../svelte-page.ts";

describe("a rune module in JavaScript", () => {
	it("is read as JavaScript", async () => {
		const page = startSveltePage(Compare);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["true"]);
	});
});
