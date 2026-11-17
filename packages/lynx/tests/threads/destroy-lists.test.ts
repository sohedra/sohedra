// When the page's life ends, the main thread lets go of its lists: each list's callbacks are set
// to nothing, so Lynx cannot call into a page that is gone (it checks that a callback is a function
// before it calls it).

import { expect, it } from "@rstest/core";

import NativeList from "../fixtures/threads/NativeList.svelte";
import { startSveltePage } from "./svelte-page.ts";

it("sets every list's callbacks to nothing when the page is destroyed", async () => {
	const page = startSveltePage(NativeList, { props: () => ({ handles: {} }) });
	await page.settle();
	const list = page.engine.list(page.byClass("list"));
	expect(typeof list.componentAtIndex).toBe("function");
	expect(typeof list.componentAtIndexes).toBe("function");
	expect(typeof list.enqueueComponent).toBe("function");
	page.destroy();
	await page.settle();
	expect(list.componentAtIndex).toBeNull();
	expect(list.componentAtIndexes).toBeNull();
	expect(list.enqueueComponent).toBeNull();
	expect(page.errors).toEqual([]);
});
