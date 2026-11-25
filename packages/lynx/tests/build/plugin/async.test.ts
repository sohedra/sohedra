// An app with Svelte's async mode on: a component that awaits in a boundary with a pending
// snippet, an `{#await}` block, and a rune module that awaits in a `$derived`. Both builds take
// them, and the production build's scripts draw the pending snippet and branch first and the awaited
// values after. A page that awaits outside every boundary has no first frame, and draws once the
// background renders it.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";

let production: AppBuild;
let development: AppBuild;
let unbounded: AppBuild;

beforeAll(async () => {
	production = await buildApp("async");
	development = await buildApp("async", { development: true });
	unbounded = await buildApp("async", { entry: "./unbounded.ts" });
}, 540_000);
afterAll(() => {
	cleanBuild(production);
	cleanBuild(development);
	cleanBuild(unbounded);
});

describe("an app with Svelte's async mode on", () => {
	it("builds for production and for development, without a word", () => {
		expect([
			production.error + production.messages,
			development.error + development.messages,
			unbounded.error + unbounded.messages,
		]).toEqual(["", "", ""]);
		expect([production.ok, development.ok, unbounded.ok]).toEqual([true, true, true]);
	});

	it("draws the pending snippet and branch first, then the awaited values, which a tap updates", async () => {
		const { page } = startDevicePage(scriptsOf(production));
		try {
			expect(page.engine.texts()).toEqual(["Loading", "Waiting"]);
			expect(page.errors.map(String)).toEqual([]);
			await page.settle();
			expect(page.engine.texts()).toEqual(["Doubled: 2", "add", "ready"]);
			const add = page.engine
				.all()
				.find((element) => page.engine.state(element).classes.split(" ").includes("add"))!;
			page.engine.dispatch(add, { type: "tap" });
			await page.settle();
			expect(page.engine.texts()).toEqual(["Doubled: 4", "add", "ready"]);
			expect(page.errors.map(String)).toEqual([]);
		} finally {
			page.dispose();
		}
	});

	it("draws a page that awaits outside every boundary once the background renders it", async () => {
		const { page } = startDevicePage(scriptsOf(unbounded));
		try {
			expect(page.engine.texts()).toEqual([]);
			await page.settle();
			expect(page.engine.texts()).toEqual(["ready"]);
			expect(page.errors.map(String)).toEqual([]);
		} finally {
			page.dispose();
		}
	});
});
