// `<list-item defer>`: on the background, the row's contents go in an `{#if}` on the row's state,
// made once per row and linked to the element; the first frame draws the row empty and keeps
// `defer` in its markup, unless the row is in its list's first screen. Each list counts its first
// screen, from where it opens to where it closes.

import { describe, expect, it } from "@rstest/core";

import { component, SERVER_INTERNALS } from "../compiling.ts";

/** The background's copy, with the binding's runtime, which the first screen's helpers come from. */
const CLIENT_INTERNALS = "/binding/svelte/client-internals.ts";
const background = (source: string, options: { development?: boolean } = {}) =>
	component(source, { clientInternals: CLIENT_INTERNALS, ...options });
const mainThread = (source: string) => component(source, { thread: "main-thread" });

const each = (item: string, script = "<script>let rows = $state([{ id: 1 }]);</script>\n") =>
	`${script}<list custom-list-name="list-container">{#each rows as row (row.id)}${item}{/each}</list>`;

describe("a deferred row", () => {
	it("on the background, renders its contents in an {#if} on its state, made once per row", async () => {
		const { code } = await component(each("<list-item defer><text>{row.id}</text></list-item>"));
		expect(code).toContain(
			'import { deferredRow as __sohedraLynxDeferredRow } from "@sohedra/lynx/internal/renderer";',
		);
		expect(code).toContain(
			"const __sohedraLynxRow0 = $.derived(() => __sohedraLynxDeferredRow(() => true));",
		);
		expect(code).toContain("if ($.get(__sohedraLynxRow0).ready) $$render(consequent);");
		expect(code).toContain(
			"$.set_attribute(list_item, 'sohedra-lynx-row', $.get(__sohedraLynxRow0))",
		);
		// Directly in the block, it needs no block of its own.
		expect(code).not.toContain("if (true)");
	});

	it("in the first frame, writes its defer as its first screen says, and its contents when drawn", async () => {
		const { code } = await mainThread(each("<list-item defer><text>{row.id}</text></list-item>"));
		expect(code).toContain("$.attr('defer', __sohedraLynxDefer(true), true)");
		expect(code).toContain("if (!__sohedraLynxWaits()) {");
		expect(code).toContain("firstScreenDefer as __sohedraLynxDefer");
		expect(code).toContain("firstScreenWaits as __sohedraLynxWaits");
		expect(code).toContain(`} from "${SERVER_INTERNALS}";`);
	});

	it("reads the value of defer where it is written, so a change of it reaches the row", async () => {
		const source = each(
			"<list-item defer={row.id > 1 ? { unmountRecycled: true } : false}><text>{row.id}</text></list-item>",
		);
		const { code } = await background(source);
		expect(code).toContain(
			"__sohedraLynxDeferredRow(() => $.get(row).id > 1 ? { unmountRecycled: true } : false)",
		);
		const drawn = await mainThread(source);
		expect(drawn.code).toContain(
			"__sohedraLynxDefer(row.id > 1 ? { unmountRecycled: true } : false)",
		);
	});

	it("outside a block, gets one, which a {@const} needs, and a script for its import", async () => {
		const { code } = await component(
			"<list><list-item defer item-key='a'><text>a</text></list-item></list>",
		);
		expect(code).toContain("if (true) $$render(consequent_1);");
		expect(code).toContain("import { deferredRow as __sohedraLynxDeferredRow }");
	});

	it("at a component's root, gets a block too, and the import goes in the component's script", async () => {
		const { code } = await component(
			"<script>let { label } = $props();</script>\n<list-item defer><text>{label}</text></list-item>",
		);
		expect(code).toContain("if (true)");
		expect(code).toContain("__sohedraLynxDeferredRow(() => true)");
	});

	it("with nothing in it, still waits to be asked for", async () => {
		const { code } = await component(each("<list-item defer></list-item>"));
		expect(code).toContain("'sohedra-lynx-row'");
		expect(code).not.toContain(".ready");
	});

	it("gives each row its own state", async () => {
		const { code } = await component(
			each(
				"<list-item defer><text>a</text></list-item><list-item defer><text>b</text></list-item>",
			),
		);
		expect(code).toContain("__sohedraLynxRow0");
		expect(code).toContain("__sohedraLynxRow1");
	});

	it("warns, in a development build, about a defer it cannot see to: in a spread, or on <svelte:element>", async () => {
		const spread = await component(
			each('<list-item {...{ defer: true, "item-key": "a" }}><text>a</text></list-item>'),
			{ development: true },
		);
		expect(spread.warnings.map((warning) => warning.code)).toEqual(["list_item_defer_ignored"]);
		const element = await component(
			each('<svelte:element this={"list-item"} defer item-key="a"><text>a</text></svelte:element>'),
			{ development: true },
		);
		expect(element.warnings.map((warning) => warning.code)).toEqual(["list_item_defer_ignored"]);
		expect(element.warnings[0]!.message).toContain("<list-item defer>");
		const production = await component(
			each('<list-item {...{ defer: true, "item-key": "a" }}><text>a</text></list-item>'),
		);
		expect(production.warnings).toEqual([]);
		const mainThread = await component(
			each('<list-item {...{ defer: true, "item-key": "a" }}><text>a</text></list-item>'),
			{ development: true, thread: "main-thread" },
		);
		expect(mainThread.warnings).toEqual([]);
	});

	it("leaves a list item with no defer alone", async () => {
		const { code } = await component(each("<list-item><text>{row.id}</text></list-item>"));
		expect(code).not.toContain("__sohedraLynx");
	});

	it("takes a quoted value as the text it is: empty, it does not defer", async () => {
		const quoted = await component(each('<list-item defer="yes"><text>a</text></list-item>'));
		expect(quoted.code).toContain('__sohedraLynxDeferredRow(() => "yes")');
		const empty = await mainThread(each('<list-item defer=""><text>a</text></list-item>'));
		expect(empty.code).toContain('__sohedraLynxDefer("")');
		const mixed = await component(each('<list-item defer="a{row.id}"><text>a</text></list-item>'));
		expect(mixed.code).toContain("__sohedraLynxDeferredRow(() => true)");
	});
});

describe("a list's first screen", () => {
	const list = (attributes: string, rows: string) =>
		`<script>let rows = $state([1]); let preload = 5;</script>\n<list custom-list-name="list-container" ${attributes}>${rows}</list>`;
	const deferred =
		"{#each rows as row (row)}<list-item defer><text>{row}</text></list-item>{/each}";

	it("on the background, opens in a block before the rows and closes in one after them", async () => {
		const { code } = await background(
			list('span-count={2} preload-buffer-count={preload} initial-item-count="3"', deferred),
		);
		expect(code).toMatch(/"span-count": 2,\s*"preload-buffer-count": preload,/);
		expect(code).toContain('"initial-item-count": "3"');
		expect(code).toContain("__sohedraLynxListEnd()");
		expect(code.indexOf("__sohedraLynxList(")).toBeLessThan(code.indexOf("$.each("));
		expect(code.indexOf("__sohedraLynxListEnd()")).toBeGreaterThan(code.indexOf("$.each("));
	});

	it("in the first frame, opens in an attribute never written, and closes after the rows", async () => {
		const { code } = await mainThread(list("{...{ 'span-count': 2 }}", deferred));
		expect(code).toContain(
			"'sohedra-lynx-list': __sohedraLynxList(() => ({ ...{ 'span-count': 2 } }))",
		);
		expect(code).toContain("if (__sohedraLynxListEnd()) {");
	});

	it("names the list's place on the background in a development build, for its warning", async () => {
		const { code } = await background(list("", deferred), { development: true });
		// Its column counts from 0, as the places of Svelte's development build do.
		expect(code).toMatch(/__sohedraLynxList\(undefined, "src\/Component\.svelte:2:0"\)/);
	});

	it("counts a row with no defer in a list with a deferred row: a header, a footer", async () => {
		const rows = `<list-item item-key="h" full-span><text>h</text></list-item>${deferred}<list-item item-key="f"><text>f</text></list-item>`;
		const { code } = await background(list("", rows));
		expect(code).toContain("__sohedraLynxCount(true)");
		expect(code).toContain("__sohedraLynxCount()");
		const drawn = await mainThread(list("", rows));
		expect(drawn.code).toContain("$.attr('sohedra-lynx-count', __sohedraLynxCount(true))");
		expect(drawn.code).toContain("$.attr('sohedra-lynx-count', __sohedraLynxCount())");
	});

	it("gives a deferred row its full-span, a whole line of the first screen", async () => {
		const rows =
			"{#each rows as row (row)}<list-item defer full-span={row > 1}><text>{row}</text></list-item>{/each}";
		const { code } = await background(list("", rows));
		expect(code).toContain("__sohedraLynxDeferredRow(() => true, { fullSpan: () => row > 1 })");
		const drawn = await mainThread(list("", rows));
		expect(drawn.code).toContain("__sohedraLynxDefer(true, row > 1)");
	});

	it("counts no row only one thread renders, in {#if background}, on either thread", async () => {
		const rows = `{#if background}<list-item item-key="h"><text>h</text></list-item><list-item defer><text>d</text></list-item>{/if}${deferred}`;
		const source = `<script>import { background } from "@sohedra/lynx/env"; let rows = $state([1]);</script>\n<list custom-list-name="list-container">${rows}</list>`;
		const { code } = await background(source);
		expect(code).not.toContain("__sohedraLynxCount");
		expect(code).toContain("__sohedraLynxDeferredRow(() => true, { oneThread: true })");
		const drawn = await mainThread(source);
		expect(drawn.code).not.toContain("__sohedraLynxCount");
		expect(drawn.code).toContain("__sohedraLynxDefer(true)");
		expect(drawn.code).toContain("if (!true) {");
	});

	it("leaves a list that cannot hold a deferred row as it is written, on both threads", async () => {
		const plain = "{#each rows as row (row)}<list-item><Label {row} /></list-item>{/each}";
		const source = `<script>import Label from "./Label.svelte"; let rows = $state([1]);</script>\n<list>${plain}</list>`;
		const { code } = await background(source);
		expect(code).not.toContain("__sohedraLynx");
		const drawn = await mainThread(source);
		expect(drawn.code).not.toContain("__sohedraLynx");
		// No script is added either: an element keeps the place Svelte's development build gives it.
		const located = await background(
			'<script>let x = 1;</script>\n<list class="l"><list-item item-key="h"><text>h</text></list-item><view></view></list>',
			{ development: true },
		);
		expect(located.code).toContain("[[2, 0, [[2, 16, [[2, 40]]], [2, 66]]]]");
		const bare = await background(
			'<list class="l"><list-item item-key="h"><text>h</text></list-item></list>',
			{ development: true },
		);
		expect(bare.code).not.toContain("<script");
		expect(bare.code).toContain("[[1, 0, [[1, 16, [[1, 40]]]]]]");
	});

	it("counts a list whose rows may come from a component, a snippet or a slot", async () => {
		for (const rows of [
			"{#each rows as row (row)}<Row {row} />{/each}",
			"{#each rows as row (row)}{@render item(row)}{/each}",
			"<slot />",
		]) {
			const source = `<script>import Row from "./Row.svelte"; let { item } = $props(); let rows = $state([1]);</script>\n<list>${rows}</list>`;
			const { code } = await background(source);
			expect(code, rows).toContain("__sohedraLynxList()");
			expect(code, rows).toContain("__sohedraLynxListEnd()");
			const drawn = await mainThread(source);
			expect(drawn.code, rows).toContain("__sohedraLynxListEnd()");
		}
	});

	it("imports its helpers on one line, so the elements keep the lines they are written on", async () => {
		const { code } = await background(list("", deferred), { development: true });
		// Svelte's development build records the list where it is written: line 2.
		expect(code).toMatch(/\[\[2, 0\b/);
		const bare = await background(`<list>${deferred}</list>`, { development: true });
		expect(bare.code).toMatch(/\[\[1, \d+\b/);
	});
});
