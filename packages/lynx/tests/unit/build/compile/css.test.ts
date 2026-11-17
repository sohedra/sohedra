// A component's styles, as Lynx reads them: Svelte scopes with `:where(.svelte-xyz)`, which Lynx
// parses and never matches.

import { describe, expect, it } from "@rstest/core";

import { lynxCss } from "../../../../src/build/compile/lynx-css.ts";
import { component } from "../compiling.ts";

describe("lynxCss", () => {
	it("unwraps :where() around a scoping class, anywhere in a selector", () => {
		expect(lynxCss(".title:where(.svelte-abc12) { color: red }")).toBe(
			".title.svelte-abc12 { color: red }",
		);
		expect(lynxCss(":where(.svelte-x) b, .a:where(.svelte-x) > .b:where(.svelte-x) {}")).toBe(
			".svelte-x b, .a.svelte-x > .b.svelte-x {}",
		);
	});

	it("leaves anything else as it is", () => {
		const css = ".a:where(.b .c) {} .d:not(.e) {} :where() {} .f { color: red }";
		expect(lynxCss(css)).toBe(css);
	});
});

describe("a component's styles", () => {
	const source = `<view class="a"><text class="b">x</text></view>
<style>
	.a { color: red }
	.a .b { color: blue }
</style>`;

	it("come with the background's copy, in Lynx's form", async () => {
		const { css } = await component(source, { thread: "background" });
		expect(css).toMatch(/\.a\.svelte-\w+ \{ color: red \}/);
		expect(css).not.toContain(":where");
	});

	it("are not on the main thread's copy, which only draws the first frame", async () => {
		expect((await component(source, { thread: "main-thread" })).css).toBeUndefined();
	});

	it("are absent from a component without any", async () => {
		expect((await component("<view></view>")).css).toBeUndefined();
	});
});
