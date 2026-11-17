// What a build says when Svelte refuses a feature the custom-renderer build does not support
// (Svelte's `incompatible_with_custom_renderer` error): the build's message says what exists
// instead. One case for each message Svelte can put in that error.

import { describe, expect, it } from "@rstest/core";

import { inApp, withoutRoot } from "../app.ts";
import { component } from "../compiling.ts";

const file = inApp("Component.svelte");

/** [source, the code the build reports, the line and column Svelte points at, or "" when it gives none]. */
const cases: Record<string, [string, string, string]> = {
	"bind:this": ["<script>let el;</script>\n<view bind:this={el}></view>", "bind_directive", "2:7"],
	"bind:value": [
		"<script>let v = $state('');</script>\n<input bind:value={v} />",
		"bind_directive",
		"2:8",
	],
	"bind:clientWidth": [
		"<script>let w = $state(0);</script>\n<view bind:clientWidth={w}></view>",
		"bind_directive",
		"2:7",
	],
	"on:": ["<script>function f() {}</script>\n<view on:tap={f}></view>", "on_directive", "2:7"],
	"transition:": [
		"<script>function t() {}</script>\n<view transition:t></view>",
		"transition_directive",
		"2:7",
	],
	"in:": ["<script>function t() {}</script>\n<view in:t></view>", "in_directive", "2:7"],
	"out:": ["<script>function t() {}</script>\n<view out:t></view>", "out_directive", "2:7"],
	"animate:": [
		"<script>function t() {}\nlet a = [1];</script>\n{#each a as x (x)}<view animate:t></view>{/each}",
		"animate_directive",
		"3:25",
	],
	"{@html}": ["<script>let h = '';</script>\n{@html h}", "html_tag", "2:1"],
	"<svelte:window>": ["<svelte:window />", "svelte_window", "1:1"],
	"<svelte:document>": ["<svelte:document />", "svelte_document", "1:1"],
	"<svelte:body>": ["<svelte:body />", "svelte_body", "1:1"],
	"<svelte:head>": ["<svelte:head></svelte:head>", "svelte_head", "1:1"],
};

describe("a feature the custom-renderer build does not support", () => {
	for (const [name, [source, code, position]] of Object.entries(cases)) {
		it(`${name}: says it is not available in Svelte on Lynx, and what to use instead`, async () => {
			const error = (await component(source).catch((thrown: Error) => thrown)) as Error & {
				code?: string;
			};
			expect(error).toBeInstanceOf(Error);
			expect(error.code).toBe(code);
			const lines = error.message.split("\n");
			expect(lines[0]).toMatch(/is not available in Svelte on Lynx\.$/);
			expect(lines[1]).toBe(`${file}:${position}`);
			expect(error.message).toContain("^");
			expect(error.message).toContain(`https://sohedra.com/e/${code}`);
			// The package's own words stay out, and so does Svelte's talk of its renderer option.
			expect(error.message).not.toMatch(/customRenderer|custom-renderer|@sohedra\/lynx uses/);
			expect(withoutRoot(error.message)).toMatchSnapshot();
		});
	}

	it("names the binding for `bind:`, and nothing for another feature", async () => {
		const bound = await component(cases["bind:value"]![0]).catch((thrown: Error) => thrown);
		expect((bound as Error).message.split("\n")[0]).toBe(
			"`bind:value` is not available in Svelte on Lynx.",
		);
		const html = await component(cases["{@html}"]![0]).catch((thrown: Error) => thrown);
		expect((html as Error).message.split("\n")[0]).toBe(
			"`@html` is not available in Svelte on Lynx.",
		);
	});
});
