// Bare attributes on elements become `name={true}`: Lynx reads `<video muted>` as the attribute
// `muted` set to `true`, and Svelte's renderer would otherwise set the empty string.

import { describe, expect, it } from "@rstest/core";

import { component } from "../compiling.ts";

/** What `source` compiles to on the background, and the attributes the first frame writes. */
async function attributes(source: string): Promise<{ background: string; mainThread: string }> {
	return {
		background: (await component(source, { thread: "background" })).code,
		mainThread: (await component(source, { thread: "main-thread" })).code,
	};
}

describe("bare attributes", () => {
	it("are set to true, on both threads", async () => {
		const { background, mainThread } = await attributes("<video muted loop></video>");
		expect(background).toContain("$.set_attribute(video, 'muted', true)");
		expect(background).toContain("$.set_attribute(video, 'loop', true)");
		expect(mainThread).toContain("$.attr('muted', true, true)");
		expect(mainThread).toContain("$.attr('loop', true, true)");
	});

	it("are set to true when nested and inside blocks", async () => {
		const { background } = await attributes(
			"<view>{#if true}<list-item sticky-top><input disabled /></list-item>{/if}</view>",
		);
		expect(background).toContain("'sticky-top', true");
		expect(background).toContain("'disabled', true");
	});

	it("leave values, empty strings, directives, components and svelte:* elements alone", async () => {
		const source =
			'<script>import Widget from "./Widget.svelte"; let x = $state(false);</script>' +
			'<input placeholder="" title={\'\'} class:a={x} /><Widget flag /><svelte:element this="view" flag />';
		const { background } = await attributes(source);
		expect(background).toContain("{ placeholder: '' }");
		expect(background).toContain("$.set_attribute(input, 'title', '')");
		// A component and `svelte:element` get Svelte's own `true`.
		expect(background).toContain("Widget(node, { flag: true })");
		expect(background).toContain("$.attribute_effect($$element, () => ({ flag: true }))");
	});
});
