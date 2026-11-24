// A listener a library adds on the page's root once, outside the app's effects, then reloads. The
// root outlives each reload, and so does the listener; the main thread starts each reloaded page
// with no listeners, so the reloaded page's first patch binds the root's again, once. A listener
// removed is not bound again.

import { expect, it } from "@rstest/core";

import { root } from "../../../src/background/root-entry.ts";
import { OpCode, ROOT_ID } from "../../../src/wire/index.ts";
import PageRoot from "../../fixtures/threads/page/PageRoot.svelte";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

/** The root's listeners the last patch binds. */
const rootBinds = (page: SveltePage): unknown[] =>
	page.patches
		.at(-1)!
		.items.flatMap((item) => (item[0] === "ops" ? item[1] : []))
		.filter((op) => op[0] === OpCode.SetEvent && op[1] === ROOT_ID);

it("still hears the page's taps after each reload, once, until it is removed", async () => {
	const heard: string[] = [];
	const hear = (event: { type: string }) => void heard.push(event.type);
	const page = startSveltePage(PageRoot, { props: () => ({ handles: {}, log: [] }) });
	const tap = async () => {
		page.engine.dispatch(page.byClass("plain"), { type: "tap" });
		await page.settle();
	};
	await page.settle();
	page.asBackground(() => root.addEventListener("tap", hear, { capture: true }));
	await page.settle();
	await tap();
	for (let reload = 1; reload <= 2; reload++) {
		page.reload();
		await page.settle();
		expect(rootBinds(page)).toHaveLength(1);
		await tap();
		expect(heard).toHaveLength(1 + reload);
	}
	page.asBackground(() => root.removeEventListener("tap", hear, { capture: true }));
	await page.settle();
	await tap();
	page.reload();
	await page.settle();
	expect(rootBinds(page)).toEqual([]);
	await tap();
	expect(heard).toEqual(["tap", "tap", "tap"]);
	expect(page.errors).toEqual([]);
});
