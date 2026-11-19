// A lazy bundle across both threads of a built page, on threads shaped like a device's
// (device-threads.ts): a tap imports a component that is a bundle of its own; the background runs
// its background section, the main thread its main-thread section and its styles, and the
// component shows, with its main-thread function there. A module-level `import()`, before the page
// starts, loads too.

import vm from "node:vm";

import { beforeAll, describe, expect, it } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { FUNCTIONS_GLOBAL } from "../../src/wire/index.ts";
import { scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { lazyBundlesOf, startDevicePage } from "./device-threads.ts";
import { sharedBuild } from "./shared-build.ts";

const PAGE = "http://localhost:3000/main.lynx.bundle";

let build: AppBuild;
beforeAll(async () => {
	build = await sharedBuild("production", "lazy-page");
}, 180_000);

function byClass(page: TestPage, token: string): LynxElement | undefined {
	return page.engine
		.all()
		.find((element) => page.engine.state(element).classes.split(" ").includes(token));
}

describe("a lazy bundle on threads shaped like a device's", () => {
	it("builds", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("loads a module-level import() as the page starts, before mountPage ran", async () => {
		const { page } = startDevicePage(scriptsOf(build), {
			url: PAGE,
			bundles: lazyBundlesOf(build),
		});
		try {
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["load", "early"]);
		} finally {
			page.dispose();
		}
	});

	it("loads on both threads at a tap: the component shows with its styles and main-thread function", async () => {
		const bundles = lazyBundlesOf(build);
		const heavy = Object.keys(bundles).find((url) => url.includes("_Heavy.svelte."))!;
		const { page, mainThread } = startDevicePage(scriptsOf(build), { url: PAGE, bundles });
		try {
			await page.settle();
			expect(byClass(page, "heavy")).toBeUndefined();
			page.engine.dispatch(byClass(page, "load")!, { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["load", "heavy", "early"]);
			expect(byClass(page, "heavy")).toBeDefined();
			expect(page.engine.adoptedStyleSheets).toContain(bundles[heavy]!.styles);
			const bodies = vm.runInContext(
				`Object.keys(${FUNCTIONS_GLOBAL}.bodies)`,
				mainThread,
			) as string[];
			expect(bodies).toHaveLength(1);
		} finally {
			page.dispose();
		}
	});
});
