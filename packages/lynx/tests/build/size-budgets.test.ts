// The size of each thread's script, in bytes of a production build of its own entry, against a
// budget: the measured size and about 2% more. A build of one entry, as an app's is: in a build of
// several, a module more than one entry uses is not concatenated into its entry's scope, which
// makes it larger. Growth here usually means code reaching a thread that does not run it, so
// raising a budget is a deliberate change, explained in its pull request.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";

/** The bytes of `text`, as the engine reads the file. */
const bytes = (text: string): number => Buffer.byteLength(text, "utf8");

let runtime: AppBuild;
let page: AppBuild;

beforeAll(async () => {
	// No page: what the main thread's script holds is the binding's runtime alone.
	runtime = await buildApp("minimal", { entry: "./runtime.ts" });
	page = await buildApp("minimal");
}, 180_000);
afterAll(() => {
	cleanBuild(runtime);
	cleanBuild(page);
});

describe("the size of a thread's script", () => {
	it("builds", () => {
		for (const build of [runtime, page]) {
			expect(build.error + build.messages).toBe("");
			expect(build.ok).toBe(true);
		}
	});

	it("is within budget for the main thread's runtime: an entry with no page (80,973 bytes measured)", () => {
		expect(bytes(scriptsOf(runtime).mainThread)).toBeLessThanOrEqual(82_600);
	});

	it("is within budget for a minimal page's main thread, with its first frame (107,128 bytes measured)", () => {
		expect(bytes(scriptsOf(page).mainThread)).toBeLessThanOrEqual(109_300);
	});

	it("is within budget for a minimal page's background: Svelte, the renderer and the page (106,053 bytes measured)", () => {
		// Raised from 96,500 by Svelte's newest renderer build: its batching rewrite and crossing code.
		expect(bytes(scriptsOf(page).background)).toBeLessThanOrEqual(108_200);
	});
});
