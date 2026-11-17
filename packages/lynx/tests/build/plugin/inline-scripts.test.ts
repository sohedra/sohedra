// `output.inlineScripts` decides whether a script that is not the page's own goes into the bundle
// or is loaded from its file.

import { afterEach, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, readTemplate } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild | undefined;
afterEach(() => {
	if (build) cleanBuild(build);
	build = undefined;
});

/** What the page's `app-service.js` does with the chunk Rsbuild split out. */
async function serviceOf(inlineScripts: boolean): Promise<string> {
	build = await buildApp("env", {
		rsbuild: {
			output: { inlineScripts },
			// A package of node_modules in a chunk of its own.
			performance: { chunkSplit: { strategy: "split-by-module" } },
		},
	});
	expect(build.error + build.messages).toBe("");
	return readTemplate(build)["manifest"]["/app-service.js"] as string;
}

describe("output.inlineScripts", () => {
	it("is on unless the app turns it off: a split chunk is required from the bundle", async () => {
		const service = await serviceOf(true);
		expect(service).toMatch(/lynx\.requireModule\("\/static\/js\/npm-swc_helpers\.[0-9a-f]+\.js"/);
		expect(service).not.toContain('lynx.requireModuleAsync("/static/js/');
	}, 180_000);

	it("makes a split chunk a file of its own, loaded when the bundle is, when the app turns it off", async () => {
		const service = await serviceOf(false);
		expect(service).toMatch(
			/lynx\.requireModuleAsync\("\/static\/js\/npm-swc_helpers\.[0-9a-f]+\.js"/,
		);
	}, 180_000);
});
