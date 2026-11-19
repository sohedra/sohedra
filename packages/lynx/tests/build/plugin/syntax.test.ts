// The build reads the Svelte compiler's output as TypeScript, which it needs for the main-thread
// functions a component's script has. JavaScript that TypeScript reads otherwise keeps its meaning
// on both threads: in a component without `lang="ts"`, a rune module written in JavaScript and a
// plain one.

import { beforeAll, describe, expect, it } from "@rstest/core";

import { scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";
import { sharedBuild } from "../shared-build.ts";

let build: AppBuild;

beforeAll(async () => {
	build = await sharedBuild("production", "syntax");
}, 180_000);

describe("`a < b > (c)` in JavaScript", () => {
	it("compares, in the first frame and on the background", async () => {
		expect(build.error + build.messages).toBe("");
		const { page } = startDevicePage(scriptsOf(build));
		try {
			expect(page.engine.texts()).toEqual(["component true", "rune module true", "module true"]);
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["component true", "rune module true", "module true"]);
		} finally {
			page.dispose();
		}
	});
});
