// A `<list-item>` written directly inside a keyed `{#each}` gets its `item-key` from the block's
// key, as a string: Lynx's list drops an item whose key is not a non-empty string. An explicit
// `item-key` wins. One that has no key at all gets a development warning.

import { describe, expect, it } from "@rstest/core";

import { docsLink } from "../../../../src/wire/index.ts";
import { component } from "../compiling.ts";

const each = (item: string, key = "(row.id)"): string =>
	`<script>let rows = $state([{ id: 1 }]);</script>\n<list>{#each rows as row ${key}}${item}{/each}</list>`;

describe("item-key from a keyed {#each}", () => {
	it("is the block's key as a string, on both threads", async () => {
		const source = each("<list-item>{row.id}</list-item>");
		const background = await component(source, { thread: "background" });
		const mainThread = await component(source, { thread: "main-thread" });
		// Svelte computes a call once per update, and passes its value in.
		expect(background.code).toContain("$.set_attribute(list_item, 'item-key', $0)");
		expect(background.code).toContain("[() => String($.get(row).id)]");
		expect(mainThread.code).toContain("$.attr('item-key', String(row.id))");
	});

	it("is a string for a number key, such as an index", async () => {
		const source = `<list>{#each [10, 20] as value, index (index)}<list-item>{value}</list-item>{/each}</list>`;
		const background = await component(source, { thread: "background" });
		const mainThread = await component(source, { thread: "main-thread" });
		expect(background.code).toContain("[() => String(index)]");
		expect(mainThread.code).toContain("$.attr('item-key', String(index))");
	});

	it("in a development build, reaches the background's renderer as it is, which writes it as text and warns about an object", async () => {
		const source = each("<list-item>{row.id}</list-item>");
		const background = await component(source, { thread: "background", development: true });
		const mainThread = await component(source, { thread: "main-thread", development: true });
		expect(background.code).toContain("$.set_attribute(list_item, 'item-key', $.get(row).id)");
		expect(background.code).not.toContain("String(");
		expect(mainThread.code).toContain("$.attr('item-key', String(row.id))");
	});

	it("is any expression the key is", async () => {
		const { code } = await component(each("<list-item></list-item>", "(row.id + '-x')"));
		expect(code).toContain("String($.get(row).id + '-x')");
	});

	it("is not written when the list item has its own item-key", async () => {
		const source = each("<list-item item-key={row.name}></list-item>");
		const { code, warnings } = await component(source, { development: true });
		expect(code).toContain("'item-key', $.get(row).name");
		expect(code).not.toContain("'item-key', $.get(row).id");
		expect(warnings).toEqual([]);
	});

	it("is not written when the list item is not directly inside the block", async () => {
		const source = each("<view><list-item></list-item></view>");
		const { code, warnings } = await component(source, { development: true });
		expect(code).not.toContain("'item-key'");
		expect(warnings.map((warning) => warning.code)).toEqual(["list_item_without_key"]);
	});

	it("is written for each of several list items in the block", async () => {
		const { code } = await component(each("<list-item></list-item><list-item></list-item>"));
		expect(code.match(/'item-key'/g)).toHaveLength(2);
		expect(code.match(/String\(\$\.get\(row\)\.id\)/g)).toHaveLength(2);
	});

	it("is not written for an {#each} without a key", async () => {
		const { code } = await component(each("<list-item></list-item>", ""), { development: true });
		expect(code).not.toContain("'item-key'");
	});
});

describe("a list item with no key at all", () => {
	const plain = "<list><list-item>a</list-item></list>";

	it("gets a development warning with the file, the line and the fix", async () => {
		const { warnings } = await component(plain, { development: true });
		expect(warnings).toHaveLength(1);
		const [warning] = warnings;
		expect(warning!.code).toBe("list_item_without_key");
		expect(warning!.message).toMatch(/^A `<list-item>` has no key/);
		expect(warning!.message).toContain(
			"Write it directly inside a keyed `{#each}`, or give it an `item-key`.",
		);
		expect(warning!.message).toContain("Component.svelte:1:7");
		expect(warning!.message).toContain(docsLink("list_item_without_key"));
	});

	it("gets none in a production build", async () => {
		expect((await component(plain, { development: false })).warnings).toEqual([]);
	});

	it("is reported once, by the background's copy", async () => {
		expect((await component(plain, { development: true, thread: "main-thread" })).warnings).toEqual(
			[],
		);
	});

	it("gets none with an item-key of its own", async () => {
		const { warnings } = await component('<list><list-item item-key="a"></list-item></list>', {
			development: true,
		});
		expect(warnings).toEqual([]);
	});

	it("gets none when a spread could carry the key", async () => {
		const source =
			"<script>let props = {};</script><list><list-item {...props}></list-item></list>";
		expect((await component(source, { development: true })).warnings).toEqual([]);
	});
});
