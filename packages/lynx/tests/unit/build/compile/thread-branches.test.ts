// A branch only one thread renders (`{#if background}`, its `{:else}`, and their kin) is drawn
// through the runtime's `ThreadBranch` when it renders a component or a snippet, on both threads'
// copies, so the `$props.id()` of what it renders comes from a sequence of its own. Another test
// that reads a thread's flag around a component gets a development warning at the `{#if}`.

import { describe, expect, it } from "@rstest/core";

import type { Thread } from "../../../../src/wire/index.ts";
import { component } from "../compiling.ts";

const CLIENT = "/binding/client-internals.ts";
const SERVER = "/binding/server-internals.ts";

/** The component compiled for `thread`, with the binding's own runtime modules. */
async function compiled(source: string, thread: Thread = "background"): Promise<string> {
	return (await compiledWith(source, { thread })).code;
}

/** The component compiled with the binding's own runtime modules, and its warnings' codes. */
async function compiledWith(
	source: string,
	options: { thread?: Thread; development?: boolean },
): Promise<{ code: string; warnings: string[]; messages: string[] }> {
	const { code, warnings } = await component(source, {
		thread: options.thread ?? "background",
		development: options.development ?? false,
		clientInternals: CLIENT,
		serverInternals: SERVER,
	});
	return {
		code,
		warnings: warnings.map((warning) => warning.code),
		messages: warnings.map((warning) => warning.message),
	};
}

const ENV = 'import { background, mainThread } from "@sohedra/lynx/env";';
const withScript = (markup: string, imports = ENV): string =>
	`<script>${imports} import Card from "./Card.svelte"; let x = $state(false);</script>\n${markup}`;

/** The threads of the branches `code` draws through `ThreadBranch`, in order. */
const branchThreads = (code: string): string[] =>
	[...code.matchAll(/SohedraLynxThreadBranch\([^,]+, \{\s*thread: '([a-z-]+)'/g)].map(
		(match) => match[1]!,
	);

describe("a branch only one thread renders", () => {
	it("is drawn through ThreadBranch on both threads, the consequent the background's and the else the main thread's", async () => {
		const source = withScript("{#if background}<Card />{:else}<Card />{/if}<Card />");
		const background = await compiled(source, "background");
		const mainThread = await compiled(source, "main-thread");
		expect(branchThreads(background)).toEqual(["background", "main-thread"]);
		expect(branchThreads(mainThread)).toEqual(["background", "main-thread"]);
		expect(background).toContain(
			`import { ThreadBranch as SohedraLynxThreadBranch } from "${CLIENT}";`,
		);
		expect(mainThread).toContain(
			`import { ThreadBranch as SohedraLynxThreadBranch } from "${SERVER}";`,
		);
	});

	it("is recognized by !background, mainThread and !mainThread", async () => {
		expect(branchThreads(await compiled(withScript("{#if !background}<Card />{/if}")))).toEqual([
			"main-thread",
		]);
		expect(
			branchThreads(await compiled(withScript("{#if mainThread}<Card />{:else}<Card />{/if}"))),
		).toEqual(["main-thread", "background"]);
		expect(branchThreads(await compiled(withScript("{#if !mainThread}<Card />{/if}")))).toEqual([
			"background",
		]);
	});

	it("is recognized under another name, and through a namespace import", async () => {
		const renamed = withScript(
			"{#if bg}<Card />{/if}",
			'import { background as bg } from "@sohedra/lynx/env";',
		);
		expect(branchThreads(await compiled(renamed))).toEqual(["background"]);
		const namespace = withScript(
			"{#if !env.background}<Card />{/if}",
			'import * as env from "@sohedra/lynx/env";',
		);
		expect(branchThreads(await compiled(namespace))).toEqual(["main-thread"]);
	});

	it("takes each branch of an {:else if} chain after it, and the branches of an {:else if} test", async () => {
		const after = withScript("{#if background}<Card />{:else if x}<Card />{:else}<Card />{/if}");
		expect(branchThreads(await compiled(after))).toEqual([
			"background",
			"main-thread",
			"main-thread",
		]);
		const inChain = withScript("{#if x}<Card />{:else if background}<Card />{:else}<Card />{/if}");
		expect(branchThreads(await compiled(inChain))).toEqual(["background", "main-thread"]);
	});

	it("is recognized by BROWSER from esm-env, as a shared package writes it", async () => {
		const named = withScript(
			"{#if BROWSER}<Card />{:else}<Card />{/if}",
			'import { BROWSER } from "esm-env";',
		);
		expect(branchThreads(await compiled(named))).toEqual(["background", "main-thread"]);
		const renamed = withScript(
			"{#if !browser}<Card />{/if}",
			'import { BROWSER as browser } from "esm-env";',
		);
		expect(branchThreads(await compiled(renamed))).toEqual(["main-thread"]);
		const namespace = withScript(
			"{#if env.BROWSER}<Card />{/if}",
			'import * as env from "esm-env";',
		);
		expect(branchThreads(await compiled(namespace))).toEqual(["background"]);
		const other = withScript("{#if DEV}<Card />{/if}", 'import { DEV } from "esm-env";');
		expect(branchThreads(await compiled(other))).toEqual([]);
	});

	it("is the consequent of a test that is a flag and more, joined by &&, and not its else", async () => {
		const cases: [string, string[]][] = [
			["background && x", ["background"]],
			["x && background", ["background"]],
			["!background && x", ["main-thread"]],
			["x && (mainThread && x)", ["main-thread"]],
			["x && x && !mainThread", ["background"]],
		];
		for (const [test, threads] of cases) {
			const code = await compiled(withScript(`{#if ${test}}<Card />{:else}<Card />{/if}`));
			expect(branchThreads(code), test).toEqual(threads);
		}
	});

	it("takes a branch whose only caller is a <slot />", async () => {
		expect(branchThreads(await compiled(withScript("{#if background}<slot />{/if}")))).toEqual([
			"background",
		]);
	});

	it("is found inside other blocks, a component's children and snippets", async () => {
		const source = withScript(
			[
				"{#each [1, 2] as item (item)}{#if background}<Card />{/if}{/each}",
				"<Card>{#if mainThread}<Card />{/if}</Card>",
				"{#snippet piece()}{#if background}<Card />{/if}{/snippet}",
				"{#if x}{#key x}{#if !background}{@render piece()}{/if}{/key}{/if}",
			].join("\n"),
		);
		// Svelte writes a snippet before the markup around it.
		expect(branchThreads(await compiled(source)).sort()).toEqual([
			"background",
			"background",
			"main-thread",
			"main-thread",
		]);
	});

	it("keeps {@const} tags and snippets that the branch declares", async () => {
		const source = withScript(
			"{#if background}{@const label = String(x)}{#snippet tag()}<text>{label}</text>{/snippet}<Card />{@render tag()}{/if}",
		);
		const code = await compiled(source);
		expect(branchThreads(code)).toEqual(["background"]);
		expect(code).toContain("const label = ");
	});

	it("gets a script for the import in a component that has none", async () => {
		const source = '<script module>import { background } from "@sohedra/lynx/env";</script>';
		const code = await compiled(
			`${source}{#snippet s()}{/snippet}{#if background}{@render s()}{/if}`,
		);
		expect(branchThreads(code)).toEqual(["background"]);
		expect(code).toContain("SohedraLynxThreadBranch } from");
	});

	it("is left as written when it renders only elements and texts", async () => {
		const source = withScript("{#if background}<view><text>A</text></view>{:else}B{/if}");
		const code = await compiled(source);
		expect(code).not.toContain("SohedraLynxThreadBranch");
	});
});

describe("a test that is not a branch only one thread renders", () => {
	it("leaves the component as Svelte compiles it", async () => {
		const plain = await compiled(withScript("<Card />{#if x}<Card />{/if}", ""));
		expect(plain).not.toContain("SohedraLynxThreadBranch");
		for (const test of ["x || background", "!!background", "background === true"])
			expect(await compiled(withScript(`{#if ${test}}<Card />{/if}`))).not.toContain(
				"SohedraLynxThreadBranch",
			);
	});

	it("warns at the {#if} in a development build when it reads a flag around a component", async () => {
		for (const test of ["x || background", "!!background", "background === true"]) {
			const source = withScript(`<Card />\n{#if ${test}}<Card />{/if}`);
			const { warnings, messages } = await compiledWith(source, { development: true });
			expect(warnings, test).toEqual(["thread_branch_test"]);
			expect(messages[0]).toContain(`{#if ${test}}`);
			expect(messages[0]).toContain("src/Component.svelte:3:1");
		}
		// The else of a flag joined by &&: it renders on the main thread, and on the background too.
		const joined = withScript("{#if background && x}<Card />{:else}<Card />{/if}");
		expect((await compiledWith(joined, { development: true })).warnings).toEqual([
			"thread_branch_test",
		]);
	});

	it("does not warn where nothing it holds can call $props.id(), or where the build knows it", async () => {
		for (const markup of [
			"{#if background}<Card />{:else}<Card />{/if}",
			"{#if background && x}<Card />{/if}",
			"{#if background && x}<Card />{:else}<view />{/if}",
			"{#if x || background}<view><text>A</text></view>{/if}",
			"{#if x}<Card />{/if}",
		]) {
			const { warnings } = await compiledWith(withScript(markup), { development: true });
			expect(warnings, markup).toEqual([]);
		}
	});

	it("warns once, from the background's copy of a development build", async () => {
		const source = withScript("{#if !!background}<Card />{/if}");
		expect(
			(await compiledWith(source, { thread: "main-thread", development: true })).warnings,
		).toEqual([]);
		expect((await compiledWith(source, { development: false })).warnings).toEqual([]);
	});

	it("is a name that is not @sohedra/lynx/env's", async () => {
		const source = withScript(
			"{#if background}<Card />{/if}",
			'import { background } from "./flags.js";',
		);
		expect(await compiled(source)).not.toContain("SohedraLynxThreadBranch");
	});

	it("fails with the build's message when the component declares a name the build adds", async () => {
		const source = withScript(
			"{#if background}<Card />{/if}",
			'import { background } from "@sohedra/lynx/env"; import SohedraLynxThreadBranch from "./Mine.svelte";',
		);
		await expect(compiled(source)).rejects.toMatchObject({
			code: "thread_branch_name_taken",
			message: expect.stringMatching(/^The name SohedraLynxThreadBranch is one the build adds/),
		});
	});

	it("is any test when the build gives Svelte's own runtime", async () => {
		const { code } = await component(withScript("{#if background}<Card />{/if}"));
		expect(code).not.toContain("SohedraLynxThreadBranch");
	});
});
