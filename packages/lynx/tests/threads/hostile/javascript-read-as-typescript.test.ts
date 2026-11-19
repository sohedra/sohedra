// A rune module and a component written in JavaScript with `a < b > (c)` and its like (a template, a
// conditional, a sequence), which JavaScript reads as two comparisons and TypeScript as a call of `a`
// with a type argument: they keep their JavaScript meaning.

import { describe, expect, it } from "@rstest/core";

import Compare from "../../fixtures/threads/Compare.svelte";
import { startSveltePage } from "../svelte-page.ts";

describe("a rune module and a component in JavaScript", () => {
	it("is read as JavaScript", async () => {
		const page = startSveltePage(Compare);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["true true true true", "true true true true"]);
	});
});
