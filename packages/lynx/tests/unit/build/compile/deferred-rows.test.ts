// `<list-item defer>`: on the background, the row's contents go in an `{#if}` on the row's state,
// made once per row and linked to the element; the first frame draws the row empty and keeps
// `defer` in its markup.

import { describe, expect, it } from "@rstest/core";

import { component } from "../compiling.ts";

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

	it("in the first frame, is drawn empty, and keeps defer in its markup", async () => {
		const { code } = await component(each("<list-item defer><text>{row.id}</text></list-item>"), {
			thread: "main-thread",
		});
		expect(code).toContain("$.attr('defer', true, true)");
		expect(code).toContain("if (!true) {");
		expect(code).not.toContain("__sohedraLynx");
	});

	it("reads the value of defer where it is written, so a change of it reaches the row", async () => {
		const source = each(
			"<list-item defer={row.id > 1 ? { unmountRecycled: true } : false}><text>{row.id}</text></list-item>",
		);
		const background = await component(source);
		expect(background.code).toContain(
			"__sohedraLynxDeferredRow(() => $.get(row).id > 1 ? { unmountRecycled: true } : false)",
		);
		const mainThread = await component(source, { thread: "main-thread" });
		expect(mainThread.code).toContain("if (!(row.id > 1 ? { unmountRecycled: true } : false)) {");
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

	it("leaves a list item with no defer alone", async () => {
		const { code } = await component(each("<list-item><text>{row.id}</text></list-item>"));
		expect(code).not.toContain("__sohedraLynx");
	});

	it("takes a quoted value as the text it is: empty, it does not defer", async () => {
		const quoted = await component(each('<list-item defer="yes"><text>a</text></list-item>'));
		expect(quoted.code).toContain('__sohedraLynxDeferredRow(() => "yes")');
		const empty = await component(each('<list-item defer=""><text>a</text></list-item>'), {
			thread: "main-thread",
		});
		expect(empty.code).toContain('if (!"") {');
		const mixed = await component(each('<list-item defer="a{row.id}"><text>a</text></list-item>'));
		expect(mixed.code).toContain("__sohedraLynxDeferredRow(() => true)");
	});
});
