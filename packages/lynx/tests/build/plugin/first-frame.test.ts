// A production build of a page that draws its first frame: the main thread's script holds the
// page's server copy, which records how to draw the frame, and the runtime, which draws it. Run on
// the engine fake, the script draws the page from its data. The background's script holds no
// server renderer.

import { runInThisContext } from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";
import { JSDOM } from "jsdom";

import { startTestPage } from "../../../src/testing/index.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";
import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;
let scripts: ReturnType<typeof scriptsOf>;

beforeAll(async () => {
	build = await buildApp("first-frame");
	if (build.ok) scripts = scriptsOf(build);
}, 180_000);
afterAll(() => cleanBuild(build));

describe("a production build with a first frame", () => {
	it("builds without a message", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("renders the page's markup on the main thread, and not on the background", () => {
		expect(scripts.mainThread).toContain("first-frame-page");
		expect(scripts.mainThread).toContain(JSON.stringify(FIRST_FRAME_GLOBAL));
		// Svelte's server renderer, which says this when a component awaits.
		expect(scripts.mainThread).toContain("await_invalid");
		expect(scripts.background).not.toContain("await_invalid");
	});

	it("draws the page's first frame from its data, on the engine fake", () => {
		const { window } = new JSDOM("<!doctype html><body></body>");
		const page = startTestPage({
			document: window.document,
			initData: { title: "Hello" },
			// The main thread's script, as Lynx runs it: one script on the main thread's globals.
			mainThread: () => runInThisContext(scripts.mainThread),
		});
		try {
			expect(page.errors).toEqual([]);
			expect(page.engine.texts()).toEqual(["Hello: 0"]);
			const [view] = page.engine.all().slice(1);
			expect(page.engine.state(view!).classes).toBe("first-frame-page");
			expect(page.engine.state(view!).listeners.map((listener) => listener.name)).toEqual(["tap"]);
		} finally {
			page.dispose();
		}
	});
});
