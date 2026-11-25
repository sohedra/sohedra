// Svelte's server runtime imports `devalue` for `hydratable`, which only its async rendering runs.
// The main thread's build gives it a stand-in that throws, so a page's main-thread script leaves
// `devalue` out, and the first frame, which renders synchronously, still draws.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";

/** Text of `devalue`'s `uneval`, which nothing else in a page's scripts says. */
const DEVALUE_TEXT = "Cannot stringify";

let build: AppBuild;

beforeAll(async () => {
	build = await buildApp("await");
}, 180_000);
afterAll(() => cleanBuild(build));

describe("devalue on the main thread", () => {
	it("is left out of a page's main-thread script, and the stand-in is there", () => {
		expect(build.error + build.messages).toBe("");
		const { mainThread } = scriptsOf(build);
		expect(mainThread).not.toContain(DEVALUE_TEXT);
		expect(mainThread).toContain("hydratable_not_on_lynx");
	});

	it("is not needed by a first frame that draws an {#await} block", async () => {
		const { page } = startDevicePage(scriptsOf(build));
		try {
			expect(page.engine.texts()).toEqual(["Waiting"]);
			await page.settle();
			expect(page.engine.texts()).toEqual(["ready"]);
			expect(page.errors.map(String)).toEqual([]);
		} finally {
			page.dispose();
		}
	});
});
