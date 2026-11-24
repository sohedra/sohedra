// A listener a library adds on the page's root once, outside the app's effects, then a reload. The
// root outlives the reload, and so does the listener; the main thread starts the reloaded page with
// no listeners, so the reloaded page's first patch binds the root's again.

import { expect, it } from "@rstest/core";

import { root } from "../../../src/background/root-entry.ts";
import PageRoot from "../../fixtures/threads/page/PageRoot.svelte";
import { startSveltePage } from "../svelte-page.ts";

it("still hears the page's taps after a reload", async () => {
	const heard: string[] = [];
	const hear = (event: { type: string }) => void heard.push(event.type);
	const page = startSveltePage(PageRoot, { props: () => ({ handles: {}, log: [] }) });
	await page.settle();
	page.asBackground(() => root.addEventListener("tap", hear, { capture: true }));
	await page.settle();
	page.engine.dispatch(page.byClass("plain"), { type: "tap" });
	await page.settle();
	page.reload();
	await page.settle();
	page.engine.dispatch(page.byClass("plain"), { type: "tap" });
	await page.settle();
	expect(heard).toEqual(["tap", "tap"]);
	page.asBackground(() => root.removeEventListener("tap", hear, { capture: true }));
	await page.settle();
	expect(page.errors).toEqual([]);
});
