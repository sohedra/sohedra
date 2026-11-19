// Two pages whose background code the app splits into chunks: a vendor chunk of `node_modules` and
// a chunk the two pages share, inlined into each bundle (`output.inlineScripts`, on unless the app
// turns it off) or written as files of their own, and a
// lazy bundle each loads on a tap. Each page runs on threads shaped like a device's
// (device-threads.ts), its background loaded as lynx-core loads it, from the bundle's
// `/app-service.js`. The main thread's script stays whole, and so does the lazy bundle's
// background.

import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { buildApp, cleanBuild, readTemplate, scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { lazyBundlesOf, startDevicePage } from "./device-threads.ts";

const PAGES = ["a", "b"] as const;
const builds = new Map<boolean, AppBuild>();

beforeAll(async () => {
	for (const inlineScripts of [true, false])
		builds.set(
			inlineScripts,
			await buildApp("chunks", {
				entries: { a: "./a.ts", b: "./b.ts" },
				rsbuild: {
					// Inlined is the default.
					...(!inlineScripts && { output: { inlineScripts } }),
					splitChunks: {
						chunks: "all",
						minSize: 0,
						cacheGroups: {
							vendor: { test: /[\\/]node_modules[\\/]/, name: "vendor", priority: 10 },
							shared: { minChunks: 2, name: "shared", priority: 5 },
						},
					},
				},
			}),
		);
}, 360_000);
afterAll(() => {
	for (const build of builds.values()) cleanBuild(build);
});

/** The scripts a page's background loads by path: its bundle's manifest, and the chunk files. */
function modulesOf(build: AppBuild, page: string): Record<string, string> {
	const modules: Record<string, string> = { ...readTemplate(build, page)["manifest"] };
	const scripts = path.join(build.dist, "out", "static", "js");
	if (fs.existsSync(scripts))
		for (const file of fs.readdirSync(scripts).filter((name) => name.endsWith(".js")))
			modules[`/static/js/${file}`] = fs.readFileSync(path.join(scripts, file), "utf8");
	return modules;
}

function byClass(page: TestPage, token: string): LynxElement {
	const found = page.engine
		.all()
		.find((element) => page.engine.state(element).classes.split(" ").includes(token));
	if (!found) throw new Error(`No element has the class ${token}.`);
	return found;
}

describe.each([true, false])("split chunks, inlineScripts %s", (inlineScripts) => {
	let build: AppBuild;
	beforeAll(() => {
		build = builds.get(inlineScripts)!;
	});

	it("builds the vendor and shared chunks", () => {
		expect(build.error + build.messages).toBe("");
		const service = readTemplate(build, "a")["manifest"]["/app-service.js"] as string;
		const load = inlineScripts ? "requireModule" : "requireModuleAsync";
		expect(service).toMatch(new RegExp(`lynx\\.${load}\\("/static/js/vendor\\.[0-9a-f]+\\.js"`));
		expect(service).toMatch(new RegExp(`lynx\\.${load}\\("/static/js/shared\\.[0-9a-f]+\\.js"`));
		if (inlineScripts) expect(service).not.toContain('lynx.requireModuleAsync("/static/js/');
	});

	it("keeps each page's main-thread script whole", () => {
		for (const page of PAGES) {
			const { mainThread } = scriptsOf(build, page);
			expect(mainThread).toContain("shared-chunk-marker");
			expect(mainThread).not.toMatch(/static\/js\/(?:vendor|shared)\./);
		}
	});

	it("keeps the lazy bundle's background one script, whatever the app splits", () => {
		const bundles = fs.readdirSync(path.join(build.dist, "out", "lazy-bundle"));
		expect(bundles).toEqual([expect.stringMatching(/^Lazy\.svelte\.[0-9a-f]+\.bundle$/)]);
		const sections = readTemplate(build, "lazy-bundle/Lazy.svelte")["customSections"];
		expect(Object.keys(sections).toSorted()).toEqual(["background", "main-thread"]);
	});

	it.each(PAGES)("starts page %s from its chunks, and takes a tap", async (name) => {
		const { page } = startDevicePage(
			{
				mainThread: scriptsOf(build, name).mainThread,
				background: readTemplate(build, name)["manifest"]["/app-service.js"] as string,
			},
			{
				url: `http://localhost:3000/${name}.lynx.bundle`,
				modules: modulesOf(build, name),
				bundles: lazyBundlesOf(build),
			},
		);
		try {
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual([`shared-chunk-marker ${name} 0`, "load"]);
			page.engine.dispatch(byClass(page, "button"), { type: "tap" });
			page.engine.dispatch(byClass(page, "load"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual([
				`shared-chunk-marker ${name} 1`,
				"load",
				"shared-chunk-marker lazy",
			]);
		} finally {
			page.dispose();
		}
	});
});
