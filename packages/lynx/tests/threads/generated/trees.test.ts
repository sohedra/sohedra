// How the generated tests read a page's lists: the keys Lynx holds, from the list's updates, and
// the cells that show them.

import { expect, it } from "@rstest/core";

import { compilePage } from "./compile.ts";
import { askEveryRow, liveCells, startGenerated } from "./run.ts";
import type { PageState } from "./state.ts";
import { listKeys } from "./trees.ts";

const DATA: Omit<PageState, "a0"> = {
	s0: "",
	s1: "",
	s2: "",
	b0: false,
	b1: false,
	n0: 0,
	a1: [],
	t0: "view",
};

/** A page of one list from `st.a0`, unkeyed, each row holding `row`. */
const listPage = (row: string) =>
	compilePage([
		[
			"App.svelte",
			"<script>let { data, handles } = $props(); const st = $state(data); handles.st = st;</script>" +
				`<list>{#each st.a0 as item0}<list-item item-key={"e0-" + item0}>${row}</list-item>{/each}</list>`,
		],
	]);

it("reads the key an update gives an item, after the insertions", async () => {
	const compiled = await listPage("");
	const { page, handles } = startGenerated({
		compiled,
		data: { ...DATA, a0: ["b"] },
		firstFrame: false,
	});
	await page.settle();
	// The unkeyed `{#each}` gives its first item `a` and adds `b`: an update and an insertion.
	page.asBackground(() => (handles.st!["a0"] = ["a", "b"]));
	await page.settle();
	const list = page.engine.all().find((element) => page.engine.state(element).tag === "list")!;
	expect(listKeys(page.engine, list)).toEqual(["e0-a", "e0-b"]);
});

it("asks no list in the cell of a row taken out, though an item kept took its key", async () => {
	const compiled = await listPage('<list><list-item item-key="s0"></list-item></list>');
	const { page, handles } = startGenerated({
		compiled,
		data: { ...DATA, a0: ["a", "b"] },
		firstFrame: false,
	});
	await page.settle();
	const list = page.engine.all().find((element) => page.engine.state(element).tag === "list")!;
	page.engine.list(list).ask(1);
	// The unkeyed `{#each}` gives its first item `b` and takes the second out, with its cell's list.
	page.asBackground(() => (handles.st!["a0"] = ["b"]));
	await page.settle();
	await askEveryRow(page);
	expect(page.errors).toEqual([]);
});

it("counts the cells of the page a reload replaces, until the new page shows", async () => {
	const compiled = await listPage("");
	const data: PageState = { ...DATA, a0: ["a"] };
	const { page } = startGenerated({ compiled, data, firstFrame: false });
	await page.settle();
	const list = page.engine.all().find((element) => page.engine.state(element).tag === "list")!;
	const cell = page.engine.list(list).ask(0);
	page.reload({ host: data });
	// The old page stays on screen until the background's patch of the new one comes.
	expect(liveCells(page, list)).toEqual([cell]);
	await page.settle();
});

it("keeps an item's key through an update Lynx would not apply", async () => {
	const compiled = await listPage("");
	const { page } = startGenerated({ compiled, data: { ...DATA, a0: ["a"] }, firstFrame: false });
	await page.settle();
	const list = page.engine.all().find((element) => page.engine.state(element).tag === "list")!;
	// Lynx applies an update's key only with a boolean `flush`, and `from` and `to` numbers.
	for (const update of [
		{ from: 0, to: 0, "item-key": "e0-x" },
		{ from: "0", to: 0, flush: false, "item-key": "e0-x" },
		{ from: 0, to: -1, flush: false, "item-key": "e0-x" },
	])
		page.asMainThread(() =>
			page.engine.functions.__SetAttribute(list, "update-list-info", {
				insertAction: [],
				removeAction: [],
				updateAction: [update],
			}),
		);
	expect(listKeys(page.engine, list)).toEqual(["e0-a"]);
});
