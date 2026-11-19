// A canary: Svelte throws when an `{#each}` whose `{:else}` holds nothing goes from empty to
// filled, on the DOM and under a custom renderer alike (`move` reads the empty branch's nodes). The
// generator writes no empty `{:else}` until this fails.

import { expect, it } from "@rstest/core";
import { flushSync } from "svelte";

import { compilePage } from "./compile.ts";
import { startGenerated } from "./run.ts";

it("still throws when an {#each} with an empty {:else} fills", async () => {
	const compiled = await compilePage([
		[
			"App.svelte",
			"<script>let { data, handles } = $props(); const st = $state(data); handles.st = st;</script>" +
				"<view>{#each st.a0 as item}<text>{item}</text>{:else}{/each}</view>",
		],
	]);
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
