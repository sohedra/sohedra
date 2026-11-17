// The loader that compiles a `.svelte` component, for one thread. Its compile is the compile
// step's; this checks what the loader adds around it: the CSS import, the warnings, the hot
// reload, and what a failed compile looks like to the bundler.

import { describe, expect, it } from "@rstest/core";

import svelteComponentLoader from "../../../../src/build/loaders/svelte-component.ts";
import { runLoader } from "./loader-context.ts";
import type { LoaderRun } from "./loader-context.ts";

const RENDERER = "@sohedra/lynx/internal/renderer";

/** One run of the loader on `source`, for `thread`. */
function load(
	source: string,
	{ thread = "background", ...options }: { thread?: string; [option: string]: unknown } = {},
	run: LoaderRun = {},
) {
	return runLoader(svelteComponentLoader, source, {
		...run,
		options: {
			thread,
			renderer: RENDERER,
			hot: false,
			serverInternals: "/binding/svelte/server-internals.ts",
			clientInternals: "/binding/svelte/client-internals.ts",
			...options,
		},
	});
}

const rules = (bytes: number): string => {
	let css = "";
	for (let i = 0; css.length < bytes; i++) css += `.rule-${i} { margin-top: ${i}px; }\n`;
	return css;
};
const withStyle = (css: string): string =>
	`<view class="rule-0"></view>\n<style>\n${css}</style>\n`;

/** The request of the import that carries the CSS in a compiled component. */
function cssRequest(code: string | undefined): string {
	const match = /^import ("[^"\n]*\.css![^"\n]*");$/m.exec(code ?? "");
	expect(match, code).not.toBeNull();
	return JSON.parse(match![1]!) as string;
}

describe("a component on the background thread", () => {
	it("is compiled with the custom renderer and the client's internals as the build names them", async () => {
		const { code, error, sync } = await load("<view class='a'>hi</view>");
		expect(error).toBeNull();
		expect(sync).toBe(false);
		expect(code).toContain("$renderer");
		expect(code).toContain('from "/binding/svelte/client-internals.ts"');
	});

	it("hands its source map to the bundler", async () => {
		const { map } = await load("<view></view>", {}, { sourceMap: true });
		expect(map).toMatchObject({ version: 3 });
	});

	it("reports Svelte's warnings to the bundler, once, with their place", async () => {
		const { warnings } = await load(
			"<view role='x'></view>\n<style>.unused { color: red }</style>",
		);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings.map((warning) => warning.message).join("\n")).toContain("Component.svelte:");
	});

	it("tells the bundler about the files a preprocessor read, to watch them", async () => {
		const { dependencies } = await load("<view></view>", {
			preprocess: [
				{
					markup: ({ content }: { content: string }) => ({
						code: content,
						dependencies: ["/app/theme.json"],
					}),
				},
			],
		});
		expect(dependencies).toEqual(["/app/theme.json"]);
	});

	it("fails with the build's message, which hides the loader's stack", async () => {
		const { error } = await load("<view {@html x}></view>");
		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({ code: "html_tag", hideStack: true });
	});
});

describe("the import that carries a component's CSS", () => {
	it("is no longer for 8 KB of CSS than for 80 bytes: the request is a module's name in the bundle", async () => {
		const compiler = {};
		const small = cssRequest((await load(withStyle(rules(80)), {}, { compiler })).code);
		const big = cssRequest((await load(withStyle(rules(8000)), {}, { compiler })).code);
		expect(big.length).toBeLessThanOrEqual(small.length);
	});

	it("differs when the CSS differs, so a style edit is another module", async () => {
		const compiler = {};
		const one = cssRequest((await load(withStyle(rules(80)), {}, { compiler })).code);
		const two = cssRequest((await load(withStyle(rules(200)), {}, { compiler })).code);
		expect(two).not.toBe(one);
	});

	it("names the component beside the file's own, and the CSS loader by its path", async () => {
		const request = cssRequest((await load(withStyle(rules(80)))).code);
		expect(request).toMatch(/^\.\/Component\.svelte\.css!=!/);
		expect(request).toMatch(/svelte-css\.ts\?css=[0-9a-f]{12}!\.\/Component\.svelte$/);
	});

	it("is left out of a component with no style, and of the main thread's copy", async () => {
		expect((await load("<view></view>")).code).not.toContain(".css!=!");
		expect((await load(withStyle(rules(80)), { thread: "main-thread" })).code).not.toContain(
			".css!=!",
		);
	});
});

describe("the main thread's copy", () => {
	it("is compiled for Svelte's server renderer, with the server's internals as the build names them", async () => {
		const { code } = await load("<view class='a'>hi</view>", { thread: "main-thread" });
		expect(code).toContain('from "/binding/svelte/server-internals.ts"');
		expect(code).not.toContain("$renderer");
	});

	it("carries no warning: the background's copy reported them", async () => {
		const { warnings } = await load("<view role='x'></view>", { thread: "main-thread" });
		expect(warnings).toEqual([]);
	});
});

describe("hot reload", () => {
	const hot = { hot: true };

	it("swaps a component in place, with the footer written for Rspack", async () => {
		const { code } = await load("<view class='a'>hi</view>", hot, { mode: "development" });
		expect(code).toContain("import.meta.webpackHot");
		expect(code).not.toContain("import.meta.hot");
		expect(code).not.toContain("decline()");
	});

	it("declines to swap a component with main-thread functions: the main thread keeps the old ones", async () => {
		const source = `<script>function tap() { 'main thread'; }</script>\n<view main-thread:ontap={tap}></view>\n`;
		const { code } = await load(source, hot, { mode: "development" });
		expect(code).toContain("import.meta.webpackHot.decline()");
		expect(code).not.toContain("$.hmr");
	});

	it("leaves the main thread's copy as it is", async () => {
		const { code } = await load(
			"<view></view>",
			{ ...hot, thread: "main-thread" },
			{ mode: "development" },
		);
		expect(code).not.toContain("webpackHot");
	});

	it("is off when the build does not ask for it", async () => {
		const { code } = await load("<view></view>", {}, { mode: "development" });
		expect(code).not.toContain("webpackHot");
		expect(code).not.toContain("$.hmr");
	});
});
