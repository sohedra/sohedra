// The functions the engine calls on the main thread by name, when nothing listens on
// `lynx.getEngine()`: a missing one is an error Lynx reports.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../src/testing/globals.ts";
import Counter from "../fixtures/threads/Counter.svelte";
import { startSveltePage } from "./svelte-page.ts";

describe("the engine's calls on the main thread", () => {
	it("find removeComponents at a reload, and report nothing", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		page.reload();
		await page.settle();
		expect(page.errors).toEqual([]);
	});

	it("find updateGlobalProps, which flushes the tree with the options it is given", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		const flushes = page.engine.flushes.length;
		page.engine.lifecycle.updateGlobalProps({ theme: "dark" });
		expect(page.errors).toEqual([]);
		expect(page.engine.flushes.length).toBe(flushes + 1);
	});

	it("find getPageData, which has no data of the page to give", async () => {
		const page = startSveltePage(Counter);
		await page.settle();
		expect(page.asMainThread(() => (readGlobal("getPageData") as () => unknown)())).toBeNull();
	});
});
