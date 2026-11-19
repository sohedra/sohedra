// A rune module and a component written in JavaScript with `a < b > (c)` and its like (a template, a
// conditional, a sequence), which JavaScript reads as two comparisons and TypeScript as a call of `a`
// with a type argument: they keep their JavaScript meaning.

import { describe, expect, it } from "@rstest/core";

import Compare from "../../fixtures/threads/Compare.svelte";
import TsCompare from "../../fixtures/threads/TsCompare.svelte";
import drawTsCompare from "../../fixtures/threads/TsCompare.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";
import { startSveltePage } from "../svelte-page.ts";

describe("a rune module and a component in JavaScript", () => {
	it("is read as JavaScript", async () => {
		const page = startSveltePage(Compare);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["true true true true", "true true true true"]);
	});

	it("reads a TypeScript component's output as JavaScript, and its main-thread function without types", async () => {
		const page = startFunctionsPage(TsCompare, { draw: drawTsCompare, firstFrame: true });
		expect(page.engine.texts()).toEqual(["typescript true true true", "pressed 0"]);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["typescript true true true", "pressed 0"]);
		const press = page.byClass("press");
		page.engine.dispatch(press, { type: "tap" });
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.state(press).inlineStyles.get("width")).toBe("3px");
		expect(page.engine.texts()).toContain("pressed 3");
	});
});
