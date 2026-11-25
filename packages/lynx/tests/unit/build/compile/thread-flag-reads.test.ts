// A thread flag read where it reaches the markup, outside an `{#if}` test, gets a build warning: the
// two threads draw different content at one place with no block between them. An `{#if}` test, an
// event handler, an attachment and an effect are where it is safe.

import { describe, expect, it } from "@rstest/core";

import type { Thread } from "../../../../src/wire/index.ts";
import { component } from "../compiling.ts";

const CODE = "thread_flag_outside_if";
const ENV = 'import { background, mainThread } from "@sohedra/lynx/environment";';

/** A component: the flags' import and `script` in its script, then `markup`. */
const withScript = (markup: string, script = "", imports = ENV): string =>
	`<script>\n\t${imports}\n\timport Card from "./Card.svelte";\n${script}</script>\n${markup}`;

/** The messages of the warning, for a component compiled for `thread`. */
async function warnings(
	source: string,
	options: { thread?: Thread; development?: boolean } = {},
): Promise<string[]> {
	const compiled = await component(source, {
		thread: options.thread ?? "background",
		development: options.development ?? true,
	});
	return compiled.warnings
		.filter((warning) => warning.code === CODE)
		.map((warning) => warning.message.replaceAll("\\", "/"));
}

/** The first line of each warning. */
const sentences = async (source: string): Promise<string[]> =>
	(await warnings(source)).map((message) => message.split("\n")[0]!);

describe("a thread flag read outside an {#if} test", () => {
	it("warns at a ternary in markup, with the file, line, frame, fix and docs link", async () => {
		const [message, ...rest] = await warnings(
			withScript('<view>\n\t<text>{background ? "page" : "frame"}</text>\n</view>'),
		);
		expect(rest).toEqual([]);
		expect(message!.split("\n")[0]).toBe(
			"`background` is read outside an `{#if}` test, so the first frame can show something here other than the page shows once it starts.",
		);
		expect(message).toContain("src/Component.svelte:6:9");
		expect(message).toContain('6: \t<text>{background ? "page" : "frame"}</text>');
		expect(message).toContain(
			"Put each thread's part in its own branch, `{#if background}…{:else}…{/if}` (or `{#if background && user}`), or read `background` in an event handler or an effect.",
		);
		expect(message).toContain(`https://sohedra.com/e/${CODE}`);
	});

	it("warns in a class, a class directive, a style and a prop passed down", async () => {
		const found = await sentences(
			withScript(
				'<view class={mainThread ? "frame" : "page"}></view>\n<view class:on={background}></view>\n<view style:opacity={background ? 1 : 0}></view>\n<Card flag={background} />',
			),
		);
		expect(found).toHaveLength(4);
		expect(found[0]).toMatch(/^`mainThread` is read outside/);
	});

	it("warns at a snippet, a component and an element picked by a flag", async () => {
		const found = await sentences(
			withScript(
				'{#snippet real()}<text>real</text>{/snippet}\n{#snippet skeleton()}<text>…</text>{/snippet}\n{@render (background ? real : skeleton)()}\n{#snippet pick()}{@const Shown = background ? Card : Card}<Shown />{/snippet}\n<svelte:element this={background ? "view" : "text"} />',
			),
		);
		expect(found).toHaveLength(3);
	});

	it("warns at an {#each}, {#key} and {#await} expression", async () => {
		const found = await sentences(
			withScript(
				"{#each background ? [1] : [] as row}<text>{row}</text>{/each}\n{#key background}<text>k</text>{/key}\n{#await background ? Promise.resolve(1) : 1 then value}<text>{value}</text>{/await}",
			),
		);
		expect(found).toHaveLength(3);
	});

	it("warns once per place, at the first read of an expression", async () => {
		const found = await warnings(withScript("<text>{background ? mainThread : background}</text>"));
		expect(found).toHaveLength(1);
		expect(found[0]).toContain("src/Component.svelte:5:8");
	});

	it("warns where markup reads a $derived, a value or a function that depends on a flag", async () => {
		const found = await sentences(
			withScript(
				"<text>{label}</text>\n<text>{where}</text>\n<text>{describe()}</text>\n<text>{doubled}</text>",
				'\tconst label = $derived(background ? "page" : "frame");\n\tconst where = mainThread ? "frame" : "page";\n\tfunction describe() {\n\t\treturn where;\n\t}\n\tconst doubled = $derived.by(() => label + label);\n',
			),
		);
		expect(found).toEqual([
			"`label` depends on `background` and is read outside an `{#if}` test, so the first frame can show something here other than the page shows once it starts.",
			expect.stringMatching(/^`where` depends on `mainThread` and/),
			expect.stringMatching(/^`describe` depends on `mainThread` and/),
			expect.stringMatching(/^`doubled` depends on `background` and/),
		]);
	});

	it("warns where markup reads state a flag sets as the script runs, or through a function it calls", async () => {
		const found = await sentences(
			withScript(
				"<text>{count}</text>\n<text>{items.length}</text>\n<text>{other}</text>",
				"\tlet count = $state(0);\n\tlet items = $state([]);\n\tlet other = $state(0);\n\tconst bump = () => { other += 1; };\n\tif (background) {\n\t\tcount = 1;\n\t\titems.push(1);\n\t\tbump();\n\t}\n",
			),
		);
		expect(found.map((sentence) => sentence.split(" ")[0])).toEqual([
			"`count`",
			"`items`",
			"`other`",
		]);
	});

	it("warns at a read through a namespace import, esm-env's BROWSER and the module script", async () => {
		const namespace = await sentences(
			withScript(
				"<text>{env.mainThread ? 1 : 2}</text>",
				"",
				'import * as env from "@sohedra/lynx/environment";',
			),
		);
		expect(namespace).toEqual([expect.stringMatching(/^`env\.mainThread` is read outside/)]);
		const browser = await sentences(
			withScript("<text>{BROWSER ? 1 : 2}</text>", "", 'import { BROWSER } from "esm-env";'),
		);
		expect(browser).toEqual([expect.stringMatching(/^`BROWSER` is read outside/)]);
		const module = await sentences(
			`<script module>\n\t${ENV}\n\texport const loadedOn = background ? "page" : "frame";\n</script>\n<text>{loadedOn}</text>`,
		);
		expect(module).toEqual([expect.stringMatching(/^`loadedOn` depends on `background`/)]);
	});

	it("warns at a component picked by a flag or a name that depends on one", async () => {
		const found = await warnings(
			withScript(
				"<Shown />\n<Picked />",
				'\timport A from "./A.svelte";\n\timport B from "./B.svelte";\n\tconst Shown = $derived(background ? A : B);\n\tlet Picked = A;\n\tif (mainThread) Picked = B;\n',
			),
		);
		expect(found.map((message) => message.split("\n")[0]!.split(" ")[0])).toEqual([
			"`Shown`",
			"`Picked`",
		]);
		expect(found[0]).toContain("src/Component.svelte:10:2");
	});

	it("warns where markup reads a class, or a function's default parameter, that reads a flag", async () => {
		const found = await sentences(
			withScript(
				"<text>{store.label}</text>\n<text>{shown()}</text>",
				'\tclass Store {\n\t\tlabel = background ? "page" : "frame";\n\t}\n\tconst store = new Store();\n\tfunction shown(value = mainThread) {\n\t\treturn value;\n\t}\n',
			),
		);
		expect(found.map((sentence) => sentence.split(" ")[0])).toEqual(["`store`", "`shown`"]);
	});

	it("warns inside an {#if} whose test only depends on a flag", async () => {
		const found = await sentences(
			withScript(
				"{#if user}<text>{user.name}</text>{:else}<text>Log in</text>{/if}",
				'\tlet user = $state(null);\n\tif (background) user = { name: "Ada" };\n',
			),
		);
		expect(found).toEqual([expect.stringMatching(/^`user` depends on `background`/)]);
	});

	it("warns where a flag sets state before an await, or outside a deferred callback", async () => {
		const found = await sentences(
			withScript(
				"<text>{before}</text>\n<text>{chained}</text>",
				'\tlet before = $state(0);\n\tlet chained = $state(0);\n\tasync function load() {\n\t\tbefore = 1;\n\t\tawait fetch("x");\n\t}\n\tif (background) {\n\t\tload();\n\t\tchained = [1].map((n) => n)[0];\n\t}\n',
			),
		);
		expect(found.map((sentence) => sentence.split(" ")[0])).toEqual(["`before`", "`chained`"]);
	});
});

describe("a thread flag read where it is safe", () => {
	it("is quiet in {#if} tests, whatever their form, and their {:else if}", async () => {
		expect(
			await warnings(
				withScript(
					"{#if background}<Card />{/if}\n{#if !mainThread}<text>a</text>{/if}\n{#if background && ready}<text>b</text>{/if}\n{#if background === true}<text>c</text>{:else if mainThread || ready}<text>d</text>{/if}\n{#if label}<text>e</text>{/if}",
					"\tlet ready = $state(false);\n\tconst label = $derived(background);\n",
				),
			),
		).toEqual([]);
	});

	it("is quiet in event handlers, main-thread handlers and attachments", async () => {
		expect(
			await warnings(
				withScript(
					"<view ontap={() => { if (background) ready = true; }}></view>\n<view ontap={tap}></view>\n<Card onselect={tap} />\n<view main-thread:ontap={slide}></view>\n<view {@attach (node) => { if (background) ready = !!node; }}></view>",
					'\tlet ready = $state(false);\n\tfunction tap() {\n\t\tif (background) ready = true;\n\t}\n\tfunction slide() {\n\t\t"main thread";\n\t\treturn mainThread;\n\t}\n',
				),
			),
		).toEqual([]);
	});

	it("is quiet in effects, even when they set what markup reads", async () => {
		expect(
			await warnings(
				withScript(
					"<text>{count}</text>",
					'\timport { onMount } from "svelte";\n\tlet count = $state(0);\n\t$effect(() => { count = background ? 1 : 2; });\n\t$effect.pre(() => { if (mainThread) count = 3; });\n\tonMount(() => { count = background ? 4 : 5; });\n',
				),
			),
		).toEqual([]);
	});

	it("is quiet for a script read that reaches no markup, and for names that only look like a flag", async () => {
		expect(
			await warnings(
				withScript(
					"<text>{user.background}</text>\n<text>{shown.mainThread}</text>\n<text>{count}</text>",
					'\tlet count = $state(0);\n\tconst user = { background: "blue" };\n\tconst shown = { mainThread: 1 };\n\tif (background && count > 1) console.log("started");\n\tconst saved = background ? "page" : "frame";\n\tconsole.log(saved);\n',
				),
			),
		).toEqual([]);
	});

	it("is quiet inside a branch only one thread renders, as the fix asks", async () => {
		expect(
			await warnings(
				withScript(
					'{#if background}<text>{label}</text>{:else}<text>{mainThread ? "frame" : "page"}</text>{/if}\n{#if background}<text>{background ? "a" : "b"}</text>{/if}\n{#if background && user}<text>{user.name}</text>{:else}<text>Log in</text>{/if}\n{#if !mainThread}<Shown />{/if}',
					'\tconst label = $derived(background ? "Hi" : "Loading");\n\tlet user = $state(null);\n\tif (background) user = { name: "Ada" };\n\tconst Shown = $derived(background ? Card : Card);\n',
				),
			),
		).toEqual([]);
	});

	it("is quiet for data a flag loads after the first render: after an await, in .then and in timers", async () => {
		expect(
			await warnings(
				withScript(
					"{#each items as item}<text>{item}</text>{/each}\n<text>{data}</text>\n<text>{ticks}</text>\n<text>{late}</text>",
					'\tlet items = $state([]);\n\tlet data = $state(null);\n\tlet ticks = $state(0);\n\tlet late = $state(0);\n\tasync function load() {\n\t\titems = await fetchItems();\n\t}\n\tasync function fetchItems() {\n\t\treturn [];\n\t}\n\tif (background) {\n\t\tload();\n\t\tfetch("x").then((response) => {\n\t\t\tdata = response;\n\t\t}).finally(() => { late = 1; });\n\t\tsetInterval(() => ticks++, 1000);\n\t\tsetTimeout(() => { late = 2; });\n\t}\n',
				),
			),
		).toEqual([]);
	});

	it("is quiet for a markup or function name that shadows a flag or a name that depends on one", async () => {
		expect(
			await warnings(
				withScript(
					'{#each rows as label}<text>{label}</text>{/each}\n{#snippet swatch(background)}<view style:background-color={background}></view>{/snippet}\n{@render swatch("red")}\n{#each rows as row}{@const label = row}<text>{label}</text>{/each}\n<text>{shout("x")}</text>\n<text>{format(1)}</text>',
					'\tconst rows = ["a"];\n\tconst label = $derived(background ? "p" : "f");\n\tfunction shout(label) {\n\t\treturn label + "!";\n\t}\n\tfunction format(n) {\n\t\tconst label = String(n);\n\t\treturn label;\n\t}\n',
				),
			),
		).toEqual([]);
	});

	it("is quiet in production builds", async () => {
		const source = withScript("<text>{background ? 1 : 2}</text>");
		expect(await warnings(source, { development: false })).toEqual([]);
	});

	it("is quiet without a flag's import, on the main thread's copy, and when silenced", async () => {
		expect(
			await warnings(
				"<script>\n\tlet background = $state(true);\n</script>\n<text>{background ? 1 : 2}</text>",
			),
		).toEqual([]);
		const source = withScript("<text>{background ? 1 : 2}</text>");
		expect(await warnings(source, { thread: "main-thread" })).toEqual([]);
		expect(
			await warnings(
				withScript(`<!-- sohedra-ignore ${CODE} -->\n<text>{background ? 1 : 2}</text>`),
			),
		).toEqual([]);
	});
});
