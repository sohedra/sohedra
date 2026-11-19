// A component compiled with `hmr: true` ends with a footer written for Vite. Rspack runs the
// changed module again and passes state from the old run to the new one in `hot.data`, so the
// build writes the footer again.

import { describe, expect, it } from "@rstest/core";

import { rewriteHotFooter } from "../../../../src/build/loaders/hot-reload.ts";
import { svelteCompiler } from "../../../../src/svelte/build/index.ts";
import { APP_ROOT } from "../app.ts";

const RELOAD = "/app/node_modules/@lynx-js/webpack-dev-transport/reloadApp.js";

/** A component compiled with `hmr: true`, as the build compiles it. */
function hot(markup = "<view class='a'>hi</view>"): string {
	return svelteCompiler(APP_ROOT).compile(markup, {
		generate: "client",
		fragments: "tree",
		hmr: true,
		dev: true,
		css: "external",
		runes: true,
		filename: "A.svelte",
		experimental: { customRenderer: "@sohedra/lynx/internal/renderer" },
	}).js.code;
}

describe("the hot-reload footer", () => {
	it("keeps the first run's wrapper in hot.data and hands it each new version", () => {
		const code = rewriteHotFooter({
			code: hot(),
			styles: ".a { color: red }",
			reloadModule: RELOAD,
		});
		expect(code).toBeDefined();
		expect(code).not.toContain("import.meta.hot");
		expect(code).toContain("if (import.meta.webpackHot) {");
		expect(code).toContain("A = $.hmr(A);");
		expect(code).toContain("__hot.data && __hot.data.svelteLynxComponent");
		expect(code).toContain("__first[$.HMR].update(A)");
		expect(code).toContain("__hot.accept();");
	});

	it("reloads the page when the component's styles changed, since they are in the page's bundle", () => {
		const code = rewriteHotFooter({
			code: hot(),
			styles: ".a { color: red }",
			reloadModule: RELOAD,
		})!;
		expect(code).toContain('const __styles = ".a { color: red }";');
		expect(code).toContain("__hot.data.svelteLynxStyles !== __styles) __svelteLynxReloadPage();");
		expect(code).toContain(`import { reloadPage as __svelteLynxReloadPage } from "${RELOAD}";\n`);
	});

	it("writes the styles as a literal that survives `<`, `>` and the line separators", () => {
		const code = rewriteHotFooter({
			code: hot(),
			styles: ".a::before { content: '</script>\u2028\u2029' }",
			reloadModule: RELOAD,
		})!;
		expect(code).not.toContain("</script>");
		expect(code).not.toContain("\u2028");
		expect(code).not.toContain("\u2029");
		expect(code).toContain("\\u003c/script\\u003e\\u2028\\u2029");
	});

	it("changes only the end of the module, so Svelte's source map still points into it", () => {
		const code = hot();
		const rewritten = rewriteHotFooter({ code, styles: "", reloadModule: RELOAD })!;
		const body = code.slice(0, code.indexOf("if (import.meta.hot)"));
		expect(rewritten.startsWith(body)).toBe(true);
	});

	it("is not there when the module has no footer, and the caller decides what to say", () => {
		expect(
			rewriteHotFooter({
				code: "export default function A() {}",
				styles: "",
				reloadModule: RELOAD,
			}),
		).toBeUndefined();
	});
});
