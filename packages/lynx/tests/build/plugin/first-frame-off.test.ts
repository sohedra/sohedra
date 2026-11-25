// A production build in which no page draws its first frame: the main thread's runtime leaves the
// drawing of the frame and its hydration out, and the page draws once the background renders it. A
// build in which one page of several draws keeps them for every page: its pages share the runtime.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";

/** Text of the first frame's markup parser, which only drawing the frame needs. */
const DRAWING_TEXT = '"keygen"';
/** Text of hydration, which only a drawn frame needs. */
const HYDRATION_TEXT = '"adopted"';

let off: AppBuild;
let mixed: AppBuild;

beforeAll(async () => {
	off = await buildApp("minimal", { plugin: { firstFrame: false } });
	mixed = await buildApp("minimal", {
		entries: { drawn: "./index.ts", plain: "./index.ts" },
		plugin: { firstFrame: (entry) => entry === "drawn" },
	});
}, 360_000);
afterAll(() => {
	cleanBuild(off);
	cleanBuild(mixed);
});

describe("a build with no first frame", () => {
	it("builds without a word", () => {
		expect([off.error + off.messages, mixed.error + mixed.messages]).toEqual(["", ""]);
	});

	it("leaves the drawing of the first frame and hydration out of the main thread", () => {
		const { mainThread } = scriptsOf(off);
		expect(mainThread).not.toContain(DRAWING_TEXT);
		expect(mainThread).not.toContain(HYDRATION_TEXT);
	});

	it("draws the page once the background renders it", async () => {
		const { page } = startDevicePage(scriptsOf(off));
		try {
			expect(page.engine.texts()).toEqual([]);
			await page.settle();
			expect(page.engine.texts()).toEqual(["Hello"]);
			expect(page.errors.map(String)).toEqual([]);
		} finally {
			page.dispose();
		}
	});

	it("keeps them when another page of the build draws its first frame", () => {
		for (const entry of ["drawn", "plain"]) {
			const { mainThread } = scriptsOf(mixed, entry);
			expect(mainThread, entry).toContain(DRAWING_TEXT);
			expect(mainThread, entry).toContain(HYDRATION_TEXT);
		}
	});
});
