// Builds that must fail or warn, and what their messages say: the file, the place, the fix and
// the docs link, as the catalogue writes them.

import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";

import { appFolder, buildApp, cleanBuild } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild | undefined;
afterEach(() => {
	if (build) cleanBuild(build);
});

describe("a component that does not compile", () => {
	it("fails the build with the file, line and column, and the code frame", async () => {
		build = await buildApp("broken", {
			files: {
				"Broken.svelte":
					'<script lang="ts">\n  let a = 1;\n</script>\n{#if a}\n  <text>{a}</text>\n</view>\n',
			},
		});
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toMatch(/Broken\.svelte:6:1/);
		expect(text).toContain("5:   <text>{a}</text>");
		expect(text).toContain("6: </view>");
	}, 120_000);
});

describe("background-only", () => {
	it("fails the build when a component imports it, naming the component", async () => {
		build = await buildApp("broken", { entry: "./bad-component.ts" });
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toContain("The component BadComponent.svelte imports 'background-only'");
		expect(text).toContain("https://sohedra.com/e/background_only_in_component");
	}, 120_000);

	it("fails the build on `export * from` in a background-only module, which hides its export names", async () => {
		build = await buildApp("broken", { entry: "./bad-star.ts" });
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toContain(
			"star.ts imports 'background-only' and has `export * from './heavy.ts'`",
		);
		expect(text).toContain("export { a, b } from './heavy.ts'");
	}, 120_000);
});

describe("an option that does not exist", () => {
	it("fails when the plugin is made, before any build", async () => {
		build = await buildApp("broken", { plugin: { firstframe: true } as never });
		expect(build.ok).toBe(false);
		expect(build.error).toContain("`firstframe` is not an option of `pluginSvelteLynx()`.");
		expect(build.error).toContain("Did you mean `firstFrame`?");
	});
});

// Svelte 5.58.0, from before custom renderers.
describe("an app that installed a Svelte without custom renderers", () => {
	it("fails as the plugin is set up, with the setup check's message", async () => {
		build = await buildApp("broken", { svelte: "svelte-without-renderers" });
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toMatch(/The installed Svelte \(5\.\d+\.\d+, [^)]+\) has no custom renderers\./);
		expect(text).toContain("https://sohedra.com/e/svelte_without_renderers");
	});
});

describe("a regular expression Lynx's engine refuses", () => {
	it("fails the build with the file, line and column, and how to write it instead", async () => {
		build = await buildApp("broken", {
			entry: "./regexps.ts",
			files: {
				"regexps.ts":
					'const word = /(?i:a)b/;\nconst set = /[\\p{L}--[a-z]]/v;\n(globalThis as Record<string, unknown>)["page"] = [word, set];\n',
			},
		});
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toContain("regexps.ts:1:14");
		expect(text).toContain("1: const word = /(?i:a)b/;");
		expect(text).toContain("regexps.ts:2:13");
		expect(text).toContain("https://sohedra.com/e/regexp_refused");
		// Once, though both threads build the module.
		expect(text.split("regexps.ts:1:14").length).toBe(2);
	}, 120_000);

	const guarded =
		'let flags = "u";\ntry {\n\tnew RegExp("", "v");\n\tflags = "v";\n} catch {}\n(globalThis as Record<string, unknown>)["page"] = flags;\n';

	it("builds with a RegExp call, which throws only where it runs, and warns in development", async () => {
		build = await buildApp("broken", {
			entry: "./guarded.ts",
			files: { "guarded.ts": guarded },
			development: true,
		});
		expect(build.ok).toBe(true);
		const text = build.error + build.messages;
		expect(text).toContain("guarded.ts:3:2");
		expect(text).toContain("the call throws a SyntaxError where it runs");
		expect(text).toContain("https://sohedra.com/e/regexp_refused_call");
		expect(text.split("guarded.ts:3:2").length).toBe(2);
	}, 120_000);

	it("builds with a RegExp call without a word in production", async () => {
		build = await buildApp("broken", { entry: "./guarded.ts", files: { "guarded.ts": guarded } });
		expect(build.ok).toBe(true);
		expect(build.error + build.messages).not.toContain("regexp_refused");
	}, 120_000);
});

describe("the app's code that fails on Lynx", () => {
	/** The fill, aliased to an empty module: the package is not a dependency here. */
	const alias = {
		resolve: {
			alias: { "@sohedra/lynx-polyfill/encoding": path.join(appFolder("broken"), "fill-stub.ts") },
		},
	};

	it("fails the build at a global no import fills, with the import that fills it", async () => {
		build = await buildApp("broken", { entry: "./unfilled.ts", rsbuild: alias });
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toContain(
			"Lynx's engine doesn't have the global `TextEncoder`, and the app imports nothing that fills it",
		);
		expect(text).toMatch(/Encode\.svelte:2:20/);
		expect(text).toContain('Import "@sohedra/lynx-polyfill/encoding" in the first line');
	}, 120_000);

	it("builds once the app imports the fill", async () => {
		build = await buildApp("broken", { entry: "./filled.ts", rsbuild: alias });
		expect(build.error + build.messages).not.toContain("fill_not_imported");
		expect(build.ok).toBe(true);
	}, 120_000);

	it("builds when the app installs the global itself", async () => {
		build = await buildApp("broken", { entry: "./installed.ts" });
		expect(build.error + build.messages).not.toContain("fill_not_imported");
		expect(build.ok).toBe(true);
	}, 120_000);

	it("fails the build at the web's DOM in a module", async () => {
		build = await buildApp("broken", { entry: "./dom.ts" });
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toContain("`document` is part of the web's DOM");
		expect(text).toMatch(/dom\.ts:1:36/);
	}, 120_000);
});

describe("a thread flag read outside an {#if} test", () => {
	it("builds, and warns in production with the file, line, column and code frame, once", async () => {
		build = await buildApp("broken", {
			entry: "./flag.ts",
			files: {
				"Flag.svelte":
					'<script>\n\timport { background } from "@sohedra/lynx/environment";\n</script>\n<view>\n\t<text>{background ? "page" : "frame"}</text>\n</view>\n',
				"flag.ts":
					'import Flag from "./Flag.svelte";\n\n(globalThis as Record<string, unknown>)["page"] = Flag;\n',
			},
		});
		expect(build.ok).toBe(true);
		const text = build.error + build.messages;
		expect(text).toContain("`background` is read outside an `{#if}` test");
		expect(text).toMatch(/Flag\.svelte:5:9/);
		expect(text).toContain('5: \t<text>{background ? "page" : "frame"}</text>');
		expect(text).toContain("https://sohedra.com/e/thread_flag_outside_if");
		// Once, though both threads build the component.
		expect(text.match(/Flag\.svelte:5:9/g)).toHaveLength(1);
	}, 120_000);
});
