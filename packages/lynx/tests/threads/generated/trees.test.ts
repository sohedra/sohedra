// How the generated tests read a page's lists: the keys Lynx holds, from the list's updates.

import { expect, it } from "@rstest/core";

import { compilePage } from "./compile.ts";
import { startGenerated } from "./run.ts";
import { listKeys } from "./trees.ts";

it("reads the key an update gives an item, after the insertions", async () => {
	const compiled = await compilePage([
		[
			"App.svelte",
			"<script>let { data, handles } = $props(); const st = $state(data); handles.st = st;</script>" +
				'<list>{#each st.a0 as item0}<list-item item-key={"e0-" + item0}></list-item>{/each}</list>',
		],
	]);
	const data = { s0: "", s1: "", s2: "", b0: false, b1: false, n0: 0, a1: [], t0: "view" as const };
	const { page, handles } = startGenerated({
		compiled,
		data: { ...data, a0: ["b"] },
		firstFrame: false,
	});
	await page.settle();
	// The unkeyed `{#each}` gives its first item `a` and adds `b`: an update and an insertion.
	page.asBackground(() => (handles.st!["a0"] = ["a", "b"]));
	await page.settle();
	const list = page.engine.all().find((element) => page.engine.state(element).tag === "list")!;
	expect(listKeys(page.engine, list)).toEqual(["e0-a", "e0-b"]);
});
