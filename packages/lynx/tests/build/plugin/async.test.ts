// An app with Svelte's async mode on: a component that awaits in a boundary with a pending
// snippet, and a rune module that awaits in a `$derived`. Both builds take them, and the production
// build's scripts draw the pending snippet first and the awaited value after.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";

let production: AppBuild;
let development: AppBuild;

beforeAll(async () => {
	production = await buildApp("async");
	development = await buildApp("async", { development: true });
}, 360_000);
afterAll(() => {
	cleanBuild(production);
	cleanBuild(development);
});

describe("an app with Svelte's async mode on", () => {
	it("builds for production and for development, without a word", () => {
		expect([
			production.error + production.messages,
			development.error + development.messages,
		]).toEqual(["", ""]);
		expect([production.ok, development.ok]).toEqual([true, true]);
	});

	it("draws the pending snippet first, then the awaited value, which a tap updates", async () => {
		const { page } = startDevicePage(scriptsOf(production));
		try {
			expect(page.engine.texts()).toEqual(["Loading"]);
			await page.settle();
			expect(page.engine.texts()).toEqual(["Doubled: 2", "add"]);
			const add = page.engine
				.all()
				.find((element) => page.engine.state(element).classes.split(" ").includes("add"))!;
			page.engine.dispatch(add, { type: "tap" });
			await page.settle();
			expect(page.engine.texts()).toEqual(["Doubled: 4", "add"]);
			expect(page.errors.map(String)).toEqual([]);
		} finally {
			page.dispose();
		}
	});
});
