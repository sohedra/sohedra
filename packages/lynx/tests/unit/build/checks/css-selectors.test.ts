// A selector outside the ones Lynx lists is a development warning at its place: Lynx's own build
// says nothing, and the rule may never apply.

import { describe, expect, it } from "@rstest/core";

import { component } from "../compiling.ts";

/** The warnings of a component with `css` as its styles, in a development build with checks. */
async function warnings(css: string, options: { development?: boolean; checks?: boolean } = {}) {
	const compiled = await component(`<view class="a b"></view>\n<style>\n${css}\n</style>`, {
		development: options.development ?? true,
		checks: options.checks ?? true,
	});
	return compiled.warnings.filter((warning) => warning.code === "css_selector_unsupported");
}

describe("a selector Lynx doesn't list", () => {
	it.each([
		["[data-on]", "the attribute selector `[data-on]`"],
		[".a:first-child", "the pseudo-class `:first-child`"],
		[".a:focus", "the pseudo-class `:focus`"],
		[".a:is(.b)", "the pseudo-class `:is(.b)`"],
		[".a:where(.b)", "the pseudo-class `:where(.b)`"],
		[".a:has(.b)", "the pseudo-class `:has(.b)`"],
		[".a::before", "the pseudo-element `::before`"],
		[":global(.a:disabled)", "the pseudo-class `:disabled`"],
		[".a:not(:first-child)", "the pseudo-class `:first-child`"],
	])("warns at %s", async (selector, part) => {
		const [warning, ...rest] = await warnings(`${selector} { color: red; }`);
		expect(rest).toEqual([]);
		expect(warning!.message.split("\n")[0]).toBe(
			`The selector \`${selector}\` uses ${part}, which is not among the selectors Lynx supports, so the rule may never apply.`,
		);
		expect(warning!.message).toContain("Component.svelte:3:1");
	});

	it("names a combinator Lynx doesn't list", async () => {
		const [warning] = await warnings(".a || .b { color: red; }");
		expect(warning!.message.split("\n")[0]).toContain("uses the `||` combinator");
	});

	it("warns at a nested rule's selector", async () => {
		const [warning, ...rest] = await warnings(".a { color: red; &[data-on] { color: blue; } }");
		expect(rest).toEqual([]);
		expect(warning!.message.split("\n")[0]).toContain("uses the attribute selector `[data-on]`");
	});

	it("warns once per selector of a list, inside a media query too", async () => {
		const found = await warnings(
			".a, .b[x] { color: red; }\n@media (min-width: 1px) { .a:first-child { color: blue; } }",
		);
		expect(found.map((warning) => warning.message.split("\n")[0])).toEqual([
			"The selector `.b[x]` uses the attribute selector `[x]`, which is not among the selectors Lynx supports, so the rule may never apply.",
			"The selector `.a:first-child` uses the pseudo-class `:first-child`, which is not among the selectors Lynx supports, so the rule may never apply.",
		]);
	});
});

describe("the selectors Lynx lists", () => {
	it("pass: types, classes, ids, *, the four combinators, :active, :hover, :not(), :root", async () => {
		const css = [
			"page view { color: red; }",
			".a.b > #c + .d ~ * { color: red; }",
			".a:active, .a:hover, .a:not(.b), :root { color: red; }",
			":global(.a .b) { color: red; }",
			"@keyframes spin { from { opacity: 0; } 50% { opacity: 1; } }",
		].join("\n");
		expect(await warnings(css)).toEqual([]);
	});
});

describe("the warning", () => {
	it("is development only, and for the app's own components", async () => {
		expect(await warnings(".a:first-child { color: red; }", { development: false })).toEqual([]);
		expect(await warnings(".a:first-child { color: red; }", { checks: false })).toEqual([]);
	});

	it("is silenced on its line by the comment", async () => {
		expect(
			await warnings(
				"/* sohedra-ignore css_selector_unsupported */\n.a:first-child { color: red; }",
			),
		).toEqual([]);
	});
});
