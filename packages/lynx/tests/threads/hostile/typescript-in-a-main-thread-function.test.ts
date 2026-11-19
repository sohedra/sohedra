// TypeScript inside a main-thread function, in the shapes where removing the types can change what
// the code does (a line break after `return`, a statement without a semicolon) or leave TypeScript
// behind (classes): the main thread runs what TypeScript means.

import { describe, expect, it } from "@rstest/core";

import TsShapes from "../../fixtures/threads/TsShapes.svelte";
import drawTsShapes from "../../fixtures/threads/TsShapes.svelte?first-frame";
import { startFunctionsPage } from "../functions/pages.ts";

describe("a main-thread function written in TypeScript", () => {
	it("runs what TypeScript means, on the main thread", async () => {
		const page = startFunctionsPage(TsShapes, { draw: drawTsShapes });
		await page.settle();
		page.engine.dispatch(page.byClass("probe"), { type: "tap" });
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.texts()).toEqual(["shapes function function 2 4 5 6 3 p"]);
	});
});
