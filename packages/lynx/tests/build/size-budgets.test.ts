// The size of each thread's script, in bytes of a production build, against a budget: the
// measured size and about 2% more. Growth here usually means code reaching a thread that does not
// run it, so raising a budget is a deliberate change, explained in its pull request.

import { beforeAll, describe, expect, it } from "@rstest/core";

import { scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { sharedBuild } from "./shared-build.ts";

/** The bytes of `text`, as the engine reads the file. */
const bytes = (text: string): number => Buffer.byteLength(text, "utf8");

let runtime: AppBuild;
let page: AppBuild;

beforeAll(async () => {
	runtime = await sharedBuild("production", "minimal-runtime");
	page = await sharedBuild("production", "minimal");
}, 180_000);

describe("the size of a thread's script", () => {
	it("builds", () => {
		expect(page.error + page.messages).toBe("");
		expect(page.ok).toBe(true);
	});

	it("is within budget for the main thread's runtime: an entry with no page (82,270 bytes measured)", () => {
		expect(bytes(scriptsOf(runtime).mainThread)).toBeLessThanOrEqual(84_000);
	});

	it("is within budget for a minimal page's main thread, with its first frame (108,013 bytes measured)", () => {
		expect(bytes(scriptsOf(page).mainThread)).toBeLessThanOrEqual(110_000);
	});

	it("is within budget for a minimal page's background: Svelte, the renderer and the page (94,536 bytes measured)", () => {
		expect(bytes(scriptsOf(page).background)).toBeLessThanOrEqual(96_500);
	});
});
