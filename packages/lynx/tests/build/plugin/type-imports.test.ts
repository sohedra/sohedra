// A component that imports a type without `type` and reads it only as a type in an effect: the
// main thread's copy keeps no such name, so the bundler never looks for a value of that name.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";

let build: AppBuild;

beforeAll(async () => {
	build = await buildApp("type-imports");
}, 180_000);
afterAll(() => cleanBuild(build));

describe("a type imported as a value and read as a type in an effect", () => {
	it("builds, and the page runs", async () => {
		expect(build.error + build.messages).toBe("");
		const { page } = startDevicePage(scriptsOf(build));
		try {
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["size 2"]);
		} finally {
			page.dispose();
		}
	});
});
