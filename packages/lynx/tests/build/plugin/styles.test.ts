// Style sheets an app imports from a script, through Rsbuild's CSS, Sass and Less rules, with
// Tailwind as a PostCSS plugin. Each loads on both threads; the background's copy goes into the
// template once, and the main thread keeps only a CSS module's class names, which its first frame
// draws.

import { pluginLess } from "@rsbuild/plugin-less";
import { pluginSass } from "@rsbuild/plugin-sass";
import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, readTemplate, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;
let selectors: string[];
let scripts: ReturnType<typeof scriptsOf>;

beforeAll(async () => {
	build = await buildApp("styles", { rsbuild: { plugins: [pluginSass(), pluginLess()] } });
	if (!build.ok) return;
	scripts = scriptsOf(build);
	// oxlint-disable-next-line typescript/no-explicit-any -- the encoded template, read by key
	const rules: any[] = Object.values(readTemplate(build)["css"].cssMap).flat();
	selectors = rules.map((rule: { selectorText: { value: string } }) => rule.selectorText.value);
}, 180_000);
afterAll(() => cleanBuild(build));

/** How many of the template's rules have `selector`. */
const count = (selector: string): number =>
	selectors.filter((written) => written === selector).length;

describe("style sheets imported from a script", () => {
	it("build without a message", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("are each in the template once: Sass, Less and Tailwind's utilities", () => {
		expect(count(".sass-page .sass-label")).toBe(1);
		expect(count(".less-page")).toBe(1);
		expect(count(".p-4")).toBe(1);
		expect(count(".text-center")).toBe(1);
	});

	it("give a CSS module's class names to both threads, and its rules to the template once", () => {
		const name = /"(card-[\w-]{4,})"/.exec(scripts.mainThread)?.[1];
		expect(name).toBeDefined();
		expect(scripts.background).toContain(name);
		expect(count(`.${name}`)).toBe(1);
	});

	it("leave no rule in either thread's script", () => {
		for (const script of [scripts.mainThread, scripts.background]) {
			expect(script).not.toContain("margin:8px");
			expect(script).not.toContain("padding:10px");
			expect(script).not.toContain("padding:6px");
		}
	});
});
