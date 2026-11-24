// What Svelte's modules that read the browser's `window` do on each thread today: `svelte/motion`
// (`Spring`, `Tween`, `prefersReducedMotion`), `svelte/reactivity/window` (`innerWidth`…) and
// `MediaQuery` from `svelte/reactivity`. The binding replaces none of them. This test only pins
// what happens; whether to replace them or refuse their import at build time is still open.
//
// The test page runs in jsdom, which has a `window` with no `matchMedia`: on the background these
// modules throw a `TypeError` there, where Lynx's background, which has no `window`, throws a
// `ReferenceError` (not checked on a device). The main thread's copies are Svelte's server modules,
// which read no `window`.

import { describe, expect, it } from "@rstest/core";

import Absent from "../fixtures/threads/modules/Absent.svelte";
import { startSveltePage } from "./svelte-page.ts";
import type { FirstFrameCopy } from "./svelte-page.ts";

const background = {
	motion: () => import("../fixtures/threads/modules/Motion.svelte"),
	window: () => import("../fixtures/threads/modules/WindowValues.svelte"),
	mediaQuery: () => import("../fixtures/threads/modules/MediaQueries.svelte"),
};

const mainThread = {
	motion: () => import("../fixtures/threads/modules/Motion.svelte?first-frame"),
	window: () => import("../fixtures/threads/modules/WindowValues.svelte?first-frame"),
	mediaQuery: () => import("../fixtures/threads/modules/MediaQueries.svelte?first-frame"),
};

/** What the first frame draws from a component's main-thread copy, before the background's page. */
async function firstFrame(load: () => Promise<{ default: unknown }>): Promise<string[]> {
	// Boundary: a `?first-frame` import is a first-frame copy.
	const draw = (await load()).default as FirstFrameCopy;
	return startSveltePage(Absent, { firstFrame: { draw } }).engine.texts();
}

describe("svelte/motion", () => {
	it("throws as it loads on the background: it makes a MediaQuery, which reads matchMedia", async () => {
		await expect(background.motion()).rejects.toThrow(/matchMedia/);
	});

	it("loads on the main thread, where the first frame draws its values at rest", async () => {
		expect(await firstFrame(mainThread.motion)).toEqual(["0", "0", "false"]);
	});
});

describe("svelte/reactivity/window", () => {
	it("throws as it loads on the background: its devicePixelRatio reads matchMedia", async () => {
		await expect(background.window()).rejects.toThrow(/matchMedia/);
	});

	it("loads on the main thread, where its values are undefined", async () => {
		expect(await firstFrame(mainThread.window)).toEqual([" x "]);
	});
});

describe("MediaQuery from svelte/reactivity", () => {
	it("loads on both threads, and throws when the background makes one: the page does not start", async () => {
		const { default: MediaQueries } = await background.mediaQuery();
		const { default: draw } = await mainThread.mediaQuery();
		const page = startSveltePage(MediaQueries, {
			// Boundary: a `?first-frame` import is a first-frame copy.
			firstFrame: { draw: draw as FirstFrameCopy },
		});
		// The server's MediaQuery matches nothing.
		expect(page.engine.texts()).toEqual(["false"]);
		await page.settle();
		expect(page.engine.texts()).toEqual(["false"]);
		expect(page.errors).toEqual([
			expect.objectContaining({
				code: "page_not_started",
				cause: expect.objectContaining({ message: expect.stringMatching(/matchMedia/) }),
			}),
		]);
	});
});
