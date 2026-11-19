// A lazy bundle across both threads of a built page, on threads shaped like a device's
// (device-threads.ts): a tap imports a component that is a bundle of its own; the background runs
// its background section, the main thread its main-thread section and its styles, and the
// component shows, with its main-thread function there.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { FUNCTIONS_GLOBAL } from "../../src/wire/index.ts";
import { buildApp, cleanBuild, readTemplate, scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { startDevicePage } from "./device-threads.ts";
import type { DeviceBundle } from "./device-threads.ts";

const PAGE = "http://localhost:3000/main.lynx.bundle";

let build: AppBuild;
beforeAll(async () => {
	build = await buildApp("lazy", { entry: "./page.ts" });
}, 180_000);
afterAll(() => cleanBuild(build));

/** The built lazy bundle, at the URL the page's chunk loader asks for. */
function lazyBundle(): Record<string, DeviceBundle> {
	const [file] = fs.readdirSync(path.join(build.dist, "out", "lazy-bundle"));
	const sections = readTemplate(build, "lazy-bundle/Heavy.svelte")["customSections"] as Record<
		string,
		{ content: unknown }
	>;
	return {
		[`http://localhost:3000/lazy-bundle/${file!}`]: {
			background: sections["background"]!.content as string,
			mainThread: sections["main-thread"]!.content as string,
			styles: JSON.stringify(sections["CSS"]!.content),
		},
	};
}

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

	it("loads on both threads at a tap: the component shows with its styles and main-thread function", async () => {
		const bundles = lazyBundle();
		const [url] = Object.keys(bundles);
		const { page, mainThread } = startDevicePage(scriptsOf(build), { url: PAGE, bundles });
		try {
			await page.settle();
			expect(byClass(page, "heavy")).toBeUndefined();
			page.engine.dispatch(byClass(page, "load")!, { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["load", "heavy"]);
			expect(byClass(page, "heavy")).toBeDefined();
			expect(page.engine.adoptedStyleSheets).toEqual([bundles[url!]!.styles]);
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
