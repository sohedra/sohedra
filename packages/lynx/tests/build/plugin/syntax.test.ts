// JavaScript that TypeScript reads otherwise keeps its meaning on both threads: in a component
// without `lang="ts"`, a rune module written in JavaScript and a plain one. `a < b > (c)` is the
// shape Svelte's printer turns into `a < b > c`; the template and the other parentheses it keeps.

import { beforeAll, describe, expect, it } from "@rstest/core";

import { scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";
import { sharedBuild } from "../shared-build.ts";

let build: AppBuild;

beforeAll(async () => {
	build = await sharedBuild("production", "syntax");
}, 180_000);

const ALL_TRUE = "true true true true";

describe("`a < b > (c)` and its like in JavaScript", () => {
	it("compares, in the first frame and on the background", async () => {
		expect(build.error + build.messages).toBe("");
		const { page } = startDevicePage(scriptsOf(build));
		try {
			expect(page.engine.texts()).toEqual([
				`component ${ALL_TRUE}`,
				`rune module ${ALL_TRUE}`,
				`module ${ALL_TRUE}`,
			]);
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual([
				`component ${ALL_TRUE}`,
				`rune module ${ALL_TRUE}`,
				`module ${ALL_TRUE}`,
			]);
		} finally {
			page.dispose();
		}
	});
});
