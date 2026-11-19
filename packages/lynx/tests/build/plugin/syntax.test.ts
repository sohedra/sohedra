// JavaScript that TypeScript reads otherwise keeps its meaning on both threads: in a component
// without `lang="ts"`, a rune module written in JavaScript and a plain one. `a < b > (c)` is the
// shape Svelte's printer turns into `a < b > c`; the template and the other parentheses it keeps.
// A `lang="ts"` component's output is JavaScript too, where Svelte's printer drops parentheses that
// TypeScript needed; its main-thread function, with types, runs without them on the main thread.

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
const TEXTS = [
	`component ${ALL_TRUE}`,
	`rune module ${ALL_TRUE}`,
	`module ${ALL_TRUE}`,
	"typescript true true true",
	"pressed 0",
];

describe("`a < b > (c)` and its like in JavaScript", () => {
	it("compares, in the first frame and on the background", async () => {
		expect(build.error + build.messages).toBe("");
		const { page } = startDevicePage(scriptsOf(build));
		try {
			expect(page.engine.texts()).toEqual(TEXTS);
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(TEXTS);
			const press = page.engine
				.all()
				.find((element) => page.engine.state(element).classes.split(" ").includes("press"))!;
			page.engine.dispatch(press, { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.state(press).inlineStyles.get("width")).toBe("3px");
			expect(page.engine.texts()).toContain("pressed 3");
		} finally {
			page.dispose();
		}
	});
});
