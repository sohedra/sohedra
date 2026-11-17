// With `hmr: true` Svelte ends a component with a footer written for Vite. The build finds it, to
// write it again for Rspack.

import { describe, expect, it } from "@rstest/core";

import { hotFooter, svelteCompiler } from "../../../../src/svelte/build/index.ts";
import { APP_ROOT } from "../../build/app.ts";

/** A component compiled as the build compiles it. */
function compiled(hmr: boolean, markup = "<view class='a'>hi</view>"): string {
	return svelteCompiler(APP_ROOT).compile(markup, {
		generate: "client",
		fragments: "tree",
		hmr,
		dev: hmr,
		css: "external",
		runes: true,
		filename: "A.svelte",
		experimental: { customRenderer: "@sohedra/lynx/internal/renderer" },
	}).js.code;
}

describe("hotFooter", () => {
	it("finds Svelte's footer, with the component's name and where the footer is", () => {
		const code = compiled(true);
		const footer = hotFooter(code);
		expect(footer?.name).toBe("A");
		expect(code.slice(footer?.start, footer?.end)).toMatch(
			/^if \(import\.meta\.hot\) \{[^]*A\[\$\.HMR\]\.update\(module\.default\);\s*\}\);\s*\}$/,
		);
	});

	it("finds the footer of a component with styles, which also cleans them up", () => {
		const footer = hotFooter(
			compiled(true, "<view class='a'>hi</view><style>.a { color: red }</style>"),
		);
		expect(footer?.name).toBe("A");
	});

	it("is not there when Svelte compiled without `hmr`", () => {
		expect(hotFooter(compiled(false))).toBeUndefined();
	});
});
