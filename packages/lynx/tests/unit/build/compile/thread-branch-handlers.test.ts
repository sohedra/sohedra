// A main-thread handler inside a branch only one thread draws gets a development warning: a
// `runOnBackground` call it makes before the background takes the page over has no answer.

import { describe, expect, it } from "@rstest/core";

import { component } from "../compiling.ts";

const ENV =
	'<script>\n\timport { background, mainThread } from "@sohedra/lynx/env";\n\tconst tap = () => { "main thread"; };\n</script>\n';

/** The handler warnings of a component, in a development build with checks. */
async function warnings(markup: string, options: { development?: boolean } = {}) {
	const compiled = await component(ENV + markup, {
		development: options.development ?? true,
		checks: true,
	});
	return compiled.warnings
		.filter((warning) => warning.code === "main_thread_handler_in_thread_branch")
		.map((warning) => warning.message);
}

describe("a main-thread handler in a thread branch", () => {
	it("warns inside {#if background}, at the attribute", async () => {
		const [message, ...rest] = await warnings(
			"{#if background}\n\t<view main-thread:ontap={tap}></view>\n{/if}",
		);
		expect(rest).toEqual([]);
		expect(message!.split("\n")[0]).toBe(
			"`main-thread:ontap` is inside `{#if background}`, which only one thread draws, so a call of `runOnBackground` it makes before the background takes the page over gets no answer.",
		);
		expect(message).toContain("Component.svelte:6:8");
		expect(message).toContain("https://sohedra.com/e/main_thread_handler_in_thread_branch");
	});

	it("warns inside {#if mainThread}'s {:else}, for a gesture too", async () => {
		const found = await warnings(
			"{#if mainThread}\n\t<text>first frame</text>\n{:else}\n\t<view main-thread:gesture={tap}></view>\n{/if}",
		);
		expect(found.map((message) => message.split("\n")[0])).toEqual([
			"`main-thread:gesture` is inside the `{:else}` of `{#if mainThread}`, which only one thread draws, so a call of `runOnBackground` it makes before the background takes the page over gets no answer.",
		]);
	});

	it("warns in a row an {#each} makes inside the branch, once", async () => {
		const found = await warnings(
			"{#if background && true}\n\t{#each [1, 2] as row}<view main-thread:ontap={tap}><text>{row}</text></view>{/each}\n{/if}",
		);
		expect(found).toHaveLength(1);
	});

	it("is quiet outside a thread branch, and for a ref or a background handler inside one", async () => {
		expect(
			await warnings(
				"<view main-thread:ontap={tap}></view>\n{#if background}\n\t<view main-thread:ref={null} ontap={() => {}} class:on={true}></view>\n{/if}\n{#if true}<view main-thread:ontap={tap}></view>{/if}",
			),
		).toEqual([]);
	});

	it("is development only, and silenced by the comment", async () => {
		const markup = "{#if background}\n\t<view main-thread:ontap={tap}></view>\n{/if}";
		expect(await warnings(markup, { development: false })).toEqual([]);
		expect(
			await warnings(
				"{#if background}\n\t<!-- svelte-lynx-ignore main_thread_handler_in_thread_branch -->\n\t<view main-thread:ontap={tap}></view>\n{/if}",
			),
		).toEqual([]);
	});
});
