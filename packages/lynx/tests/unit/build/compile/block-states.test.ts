// The blocks hydration pairs that are not an `{#if}`'s branch: the background's copy says which is
// a second state, and where an `{#await}` given a promise is; both copies wrap an `{#each}` with an
// `{:else}`, a boundary with a `pending` or a `failed`, and an `{#await}` in an `{#if}` of their own. The edits are
// read as the component's text after every pass, and each copy must still compile.

import { describe, expect, it } from "@rstest/core";
import { compile, parse } from "svelte/compiler";

import { runPasses } from "../../../../src/build/compile/passes.ts";
import type { ComponentAst } from "../../../../src/svelte/build/index.ts";
import type { Thread } from "../../../../src/wire/index.ts";
import { component } from "../compiling.ts";

const CLIENT_INTERNALS = "/binding/svelte/client-internals.ts";
const SERVER_INTERNALS = "/binding/svelte/server-internals.ts";

/** The markup of `source` after every pass, for `thread`, with the imports left out. */
function edited(source: string, thread: Thread): string {
	const result = runPasses({
		source,
		filename: "/app/src/Component.svelte",
		// Boundary: Svelte's modern tree is the component tree the passes read.
		ast: parse(source, { modern: true }) as unknown as ComponentAst,
		thread,
		development: false,
		internals: thread === "background" ? CLIENT_INTERNALS : SERVER_INTERNALS,
		root: "/app",
		sourceMap: false,
		renderer: "@sohedra/lynx/internal/renderer",
	});
	// Each copy compiles: the edits nest.
	compile(result.code, {
		generate: thread === "background" ? "client" : "server",
		runes: true,
		...(thread === "background" && {
			fragments: "tree",
			experimental: { customRenderer: "@sohedra/lynx/internal/renderer" },
		}),
	});
	// The hooks' import goes at the start of the component's script.
	return result.code.replace(/ import \{[^}]*\} from "[^"]*"; /, "");
}

const SCRIPT = "<script>let { rows, load, flag } = $props();</script>";
const both = (markup: string) => ({
	background: edited(`${SCRIPT}${markup}`, "background").slice(SCRIPT.length),
	mainThread: edited(`${SCRIPT}${markup}`, "main-thread").slice(SCRIPT.length),
});

describe("the blocks hydration pairs", () => {
	it("put a list's {:else} in an {#if} that says it is a second state, in a region on both threads", () => {
		expect(both("{#each rows as row}<text>{row}</text>{:else}<text>None</text>{/each}")).toEqual({
			background:
				"{#if true}{#each rows as row}<text>{row}</text>{:else}{#if __sohedraLynxSecond()}<text>None</text>{/if}{/each}{/if}",
			mainThread:
				"{#if true}{#each rows as row}<text>{row}</text>{:else}<text>None</text>{/each}{/if}",
		});
	});

	it("leave an {#each} with no {:else} as it is written", () => {
		const markup = "{#each rows as row}<text>{row}</text>{/each}";
		expect(both(markup)).toEqual({ background: markup, mainThread: markup });
	});

	it("put an {#await} in a region, and say what it was given and where it is on the background", () => {
		expect(
			both(
				"{#await load()}<text>Loading</text>{:then value}<text>{value}</text>{/await}<view></view>",
			),
		).toEqual({
			background:
				"{#if true}{#await __sohedraLynxAwaitGiven((load()))}<text>Loading</text>{:then value}{#if __sohedraLynxSecond()}<text>{value}</text>{/if}{/await}{#if __sohedraLynxAwaitPlace()}{/if}{/if}<view></view>",
			mainThread:
				"{#if true}{#await load()}<text>Loading</text>{:then value}<text>{value}</text>{/await}{/if}<view></view>",
		});
	});

	it("give an {#await} what a sequence expression gives", () => {
		expect(both("{#await load(), rows}<text>Loading</text>{/await}").background).toBe(
			"{#if true}{#await __sohedraLynxAwaitGiven((load(), rows))}<text>Loading</text>{/await}{#if __sohedraLynxAwaitPlace()}{/if}{/if}",
		);
	});

	it("put a boundary with a pending in a region, its pending a second state on the background", () => {
		expect(
			both(
				"<svelte:boundary>{#snippet pending()}<text>Wait</text>{/snippet}<text>Done</text></svelte:boundary>",
			),
		).toEqual({
			background:
				"{#if true}<svelte:boundary>{#snippet pending()}{#if __sohedraLynxSecond()}<text>Wait</text>{/if}{/snippet}<text>Done</text></svelte:boundary>{/if}",
			mainThread:
				"{#if true}<svelte:boundary>{#snippet pending()}<text>Wait</text>{/snippet}<text>Done</text></svelte:boundary>{/if}",
		});
	});

	it("put a boundary with a failed in a region, and leave one with neither", () => {
		const failed =
			"<svelte:boundary>{#snippet failed()}<text>Oops</text>{/snippet}<text>Done</text></svelte:boundary>";
		expect(both(failed).mainThread).toBe(`{#if true}${failed}{/if}`);
		const plain = "<svelte:boundary><text>Done</text></svelte:boundary>";
		expect(both(plain)).toEqual({ background: plain, mainThread: plain });
	});

	it("close the inner block first where blocks end together", () => {
		expect(
			both(
				"{#each rows as row}<text>{row}</text>{:else}{#each rows as other}<text>{other}</text>{:else}<text>None</text>{/each}{/each}",
			).background,
		).toBe(
			"{#if true}{#each rows as row}<text>{row}</text>{:else}{#if __sohedraLynxSecond()}{#if true}{#each rows as other}<text>{other}</text>{:else}{#if __sohedraLynxSecond()}<text>None</text>{/if}{/each}{/if}{/if}{/each}{/if}",
		);
		expect(
			both(
				"{#await load() then value}{#each rows as row}<text>{row}</text>{:else}<text>{value}</text>{/each}{/await}",
			).background,
		).toBe(
			"{#if true}{#await __sohedraLynxAwaitGiven((load())) then value}{#if __sohedraLynxSecond()}{#if true}{#each rows as row}<text>{row}</text>{:else}{#if __sohedraLynxSecond()}<text>{value}</text>{/if}{/each}{/if}{/if}{/await}{#if __sohedraLynxAwaitPlace()}{/if}{/if}",
		);
	});

	it("nest inside a branch only one thread renders", () => {
		expect(
			both(
				'<script module>import { background } from "@sohedra/lynx/environment";</script>{#if background}{#each rows as row}<text>{row}</text>{:else}<text>None</text>{/each}{/if}',
			).mainThread,
		).toContain("{#if background}{#if true}{#each rows as row}");
	});

	it("import the background's hooks from its runtime", async () => {
		const { code } = await component(`${SCRIPT}{#await load()}{:then v}<text>{v}</text>{/await}`, {
			clientInternals: CLIENT_INTERNALS,
		});
		expect(code).toMatch(
			/import \{\s*awaitGiven as __sohedraLynxAwaitGiven,\s*secondState as __sohedraLynxSecond,\s*awaitPlace as __sohedraLynxAwaitPlace\s*\} from "\/binding\/svelte\/client-internals.ts";/,
		);
	});

	it("say the wrapper of a deferred row outside a block is the background's own", async () => {
		const { code } = await component(
			"<list><list-item defer item-key='a'><text>a</text></list-item></list>",
			{ clientInternals: CLIENT_INTERNALS },
		);
		expect(code).toContain("$.derived(() => __sohedraLynxOwn())");
		expect(code).toContain("ownBranch as __sohedraLynxOwn");
	});
});
