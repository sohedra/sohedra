// A page that loads a component with `import()`: that component is its own bundle, with the
// sections the runtime loads.

import fs from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "@rstest/core";

import { readTemplate, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { sharedBuild } from "../shared-build.ts";

let build: AppBuild;

beforeAll(async () => {
	build = await sharedBuild("production", "lazy");
}, 180_000);

describe("a lazy bundle", () => {
	it("builds each import() into its own bundle, next to the page", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
		// Named for the file from the app's root (the shared build's is the fixtures' folder), and
		// one for both of the build's pages that import it: lazy-page imports Early.svelte too.
		const bundles = fs.readdirSync(path.join(build.dist, "out", "lazy-bundle")).toSorted();
		expect(bundles).toEqual([
			expect.stringMatching(/^lazy_Early\.svelte\.[0-9a-f]+\.bundle$/),
			expect.stringMatching(/^lazy_Heavy\.svelte\.[0-9a-f]+\.bundle$/),
		]);
	});

	it("has the sections the runtime loads: main-thread (a function returning the chunk), background, CSS", () => {
		const template = readTemplate(build, "lazy-bundle/lazy_Heavy.svelte");
		const sections = template["customSections"] as Record<string, { content: unknown }>;
		expect(Object.keys(sections).toSorted()).toEqual(["CSS", "background", "main-thread"]);
		const main = sections["main-thread"]!.content as string;
		// Wrapped after minification: the minimizer would drop an unused function.
		expect(main.startsWith("(function (globDynamicComponentEntry) {")).toBe(true);
		expect(main).toMatch(/return module\.exports;\s*\}\)/);
		expect(main).toContain("heavy-main-thread-tap");
		expect(sections["background"]!.content).toContain('.define("background.js"');
		expect(JSON.stringify(sections["CSS"]!.content)).toContain("#2b6cb0");
		// Nothing of it is left in the page's own background scripts.
		expect(template["manifest"]).toEqual({});
	});

	it("keeps the lazy component's code out of the page's own scripts", () => {
		expect(scriptsOf(build).mainThread).not.toContain("heavy-main-thread-tap");
	});
});
