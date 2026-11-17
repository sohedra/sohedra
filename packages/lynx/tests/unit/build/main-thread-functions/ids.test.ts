// The ids of main-thread functions are made from the file's path under the app's folder, so two
// checkouts of one app build the same bundle, and two files with one base name still get
// different ids. Both threads agree on them whatever else the build did to the file.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { APP_ROOT } from "../app.ts";
import { compileScript, component } from "../compiling.ts";
import { readOutput } from "./output.ts";

// Two folders standing for two checkouts of one app (Svelte is found from the folder upward).
const checkouts = ["checkout-one", "checkout-two"].map((name) =>
	path.join(APP_ROOT, "tests/fixtures/build", name),
);

const script = `export function f() { 'main thread'; return 1; }\n`;
const text = `<script>function f() { 'main thread'; }</script><view main-thread:ontap={f}></view>`;

const idsOf = (code: string): string[] => readOutput(code).functions.map((fn) => fn.id);

describe("ids of main-thread functions", () => {
	it("are the same in two checkouts of one app, in a script", () => {
		const [one, two] = checkouts.map(
			(root) => compileScript(script, { root, file: "page.ts" }).ids,
		);
		expect(one).toHaveLength(1);
		expect(two).toEqual(one);
	});

	it("are the same in two checkouts of one app, in a component", async () => {
		const [one, two] = await Promise.all(
			checkouts.map(async (root) =>
				idsOf((await component(text, { root, file: "Page.svelte" })).code),
			),
		);
		expect(one).toHaveLength(1);
		expect(two).toEqual(one);
	});

	it("are the same in two checkouts of one app, registered on the main thread", async () => {
		const [one, two] = await Promise.all(
			checkouts.map(
				async (root) =>
					readOutput(
						(await component(text, { root, file: "Page.svelte", thread: "main-thread" })).code,
					).registrations,
			),
		);
		expect(one).toHaveLength(1);
		expect(two).toEqual(one);
	});

	it("differ for two files with the same base name", () => {
		const [a, b] = ["a", "b"].map((dir) => compileScript(script, { file: `${dir}/page.ts` }).ids);
		expect(a).not.toEqual(b);
	});

	it("differ for two texts of one file", () => {
		const other = script.replace("return 1", "return 2");
		expect(compileScript(other).ids).not.toEqual(compileScript(script).ids);
	});

	it("stay the same on both threads", () => {
		expect(compileScript(script, { thread: "main-thread" }).ids).toEqual(
			compileScript(script, { thread: "background" }).ids,
		);
	});
});

describe("ids of a component whose other passes edit it", () => {
	const effectImport = `<script lang="ts">
	let count = $state(0);
	function onTap() { 'main thread'; console.log(count); }
	$effect(() => { import("./Lazy.svelte"); });
</script>
<view main-thread:ontap={onTap} muted></view>`;

	it("are the same on both threads when an $effect has an import()", async () => {
		const background = await component(effectImport, { thread: "background" });
		const mainThread = await component(effectImport, { thread: "main-thread" });
		expect(background.functionIds).toHaveLength(1);
		expect(mainThread.functionIds).toEqual(background.functionIds);
		expect(idsOf(mainThread.code)).toEqual(idsOf(background.code));
		expect(readOutput(mainThread.code).registrations).toEqual(background.functionIds);
	});

	it("are the same with or without the $effect's import", async () => {
		const without = effectImport.replace('import("./Lazy.svelte")', "console.log(1)");
		// The text differs, so the ids differ; what the pass adds on the main thread does not matter.
		const [one, two] = await Promise.all(
			[effectImport, without].map(async (source) => ({
				background: (await component(source, { thread: "background" })).functionIds,
				mainThread: (await component(source, { thread: "main-thread" })).functionIds,
			})),
		);
		expect(one!.mainThread).toEqual(one!.background);
		expect(two!.mainThread).toEqual(two!.background);
	});

	it("are the same on both threads with bare attributes and a keyed list item", async () => {
		const source = `<script>function f() { 'main thread'; }</script>
{#each [1, 2] as row (row)}<list-item sticky-top main-thread:ontap={f}>{row}</list-item>{/each}`;
		const background = await component(source, { thread: "background" });
		const mainThread = await component(source, { thread: "main-thread" });
		expect(mainThread.functionIds).toEqual(background.functionIds);
		expect(background.functionIds).toHaveLength(1);
	});

	it("are the same on both threads for a function written in the markup", async () => {
		const source = `<script>let a = $state(1);</script>
<view main-thread:ontap={() => { 'main thread'; console.log(a); }} muted></view>`;
		const background = await component(source, { thread: "background" });
		const mainThread = await component(source, { thread: "main-thread" });
		expect(background.functionIds).toHaveLength(1);
		expect(mainThread.functionIds).toEqual(background.functionIds);
	});
});
