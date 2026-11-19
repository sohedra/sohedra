// Builds that must fail, and what their messages say: the file, the place, the fix and the docs
// link, as the catalogue writes them.

import { afterEach, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild } from "../build-app.ts";
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

// The newest released Svelte the lockfile has: once one has custom renderers, this fails, and the
// peer range on Svelte can name it.
describe("an app that installed a released Svelte", () => {
	it("fails as the plugin is set up, with the setup check's message", async () => {
		build = await buildApp("broken", { svelte: "svelte-released" });
		expect(build.ok).toBe(false);
		const text = build.error + build.messages;
		expect(text).toMatch(/The installed Svelte \(5\.\d+\.\d+, [^)]+\) has no custom renderers\./);
		expect(text).toContain("https://sohedra.com/e/svelte_without_renderers");
	});
});
