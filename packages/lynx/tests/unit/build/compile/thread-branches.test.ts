// A branch only one thread renders (`{#if background}`, its `{:else}`, and their kin) is drawn
// through the runtime's `ThreadBranch` when it renders a component or a snippet, on both threads'
// copies, so the `$props.id()` of what it renders comes from a sequence of its own.

import { describe, expect, it } from "@rstest/core";

import type { Thread } from "../../../../src/wire/index.ts";
import { component } from "../compiling.ts";

const CLIENT = "/binding/client-internals.ts";
const SERVER = "/binding/server-internals.ts";

/** The component compiled for `thread`, with the binding's own runtime modules. */
async function compiled(source: string, thread: Thread = "background"): Promise<string> {
	const { code } = await component(source, {
		thread,
		clientInternals: CLIENT,
		serverInternals: SERVER,
	});
	return code;
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
		for (const test of [
			"background && x",
			"x || background",
			"!!background",
			"background === true",
		])
			expect(await compiled(withScript(`{#if ${test}}<Card />{/if}`))).not.toContain(
				"SohedraLynxThreadBranch",
			);
	});

	it("is a name that is not @sohedra/lynx/env's", async () => {
		const source = withScript(
			"{#if background}<Card />{/if}",
			'import { background } from "./flags.js";',
		);
		expect(await compiled(source)).not.toContain("SohedraLynxThreadBranch");
	});

	it("is any test when the build gives Svelte's own runtime", async () => {
		const { code } = await component(withScript("{#if background}<Card />{/if}"));
		expect(code).not.toContain("SohedraLynxThreadBranch");
	});
});
