// A canary: Svelte throws when an `{#each}` whose `{:else}` holds a component that renders nothing
// goes from empty to filled, on the DOM and under a custom renderer alike, as it does for an empty
// `{:else}` (./svelte-each-else.test.ts). The generator writes no such `{:else}` until this fails.
// Compiled as Svelte writes it: the compile step's `{#if}` around the `{:else}`, for hydration,
// gives it a node and sidesteps the bug.

import { expect, it } from "@rstest/core";
import { flushSync } from "svelte";

import { compilePage } from "./compile.ts";
import { startGenerated } from "./run.ts";

it("still throws when an {#each} whose {:else} component renders nothing fills", async () => {
	const compiled = await compilePage(
		[
			["Empty.svelte", ""],
			[
				"App.svelte",
				'<script>import Empty from "./Empty.svelte"; let { data, handles } = $props(); const st = $state(data); handles.st = st;</script>' +
					"<view>{#each st.a0 as item}<text>{item}</text>{:else}<Empty />{/each}</view>",
			],
		],
		{ ownPasses: false },
	);
	const data = { s0: "", s1: "", s2: "", b0: false, b1: false, n0: 0, a0: [], a1: [], t0: "view" };
	const { page, handles } = startGenerated({
		compiled,
		data: { ...data, t0: "view" },
		firstFrame: false,
	});
	await page.settle();
	expect(() =>
		page.asBackground(() => {
			handles.st!["a0"] = ["a"];
			flushSync();
		}),
	).toThrow("Cannot read properties of null (reading 'start')");
});
