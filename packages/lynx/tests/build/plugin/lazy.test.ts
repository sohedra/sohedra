// A page that loads a component with `import()`: that component is its own bundle, with the
// sections the runtime loads.

import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, readTemplate } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;

beforeAll(async () => {
	build = await buildApp("lazy");
}, 180_000);
afterAll(() => cleanBuild(build));

describe("a lazy bundle", () => {
	it("builds each import() into its own bundle, next to the page", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
		const bundles = fs.readdirSync(path.join(build.dist, "out", "lazy-bundle"));
		expect(bundles).toEqual([expect.stringMatching(/^Heavy\.svelte\.[0-9a-f]+\.bundle$/)]);
	});

	it("has the sections the runtime loads: main-thread (a function returning the chunk), background, CSS", () => {
		const template = readTemplate(build, "lazy-bundle/Heavy.svelte");
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
		const page = fs.readFileSync(
			path.join(build.dist, "out", ".lynx", "main", "main-thread.js"),
			"utf8",
		);
		expect(page).not.toContain("heavy-main-thread-tap");
	});
});
