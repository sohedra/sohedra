// An app with Svelte's async mode on: a component that awaits in a boundary with a pending
// snippet, an `{#await}` block, and a rune module that awaits in a `$derived`. Both builds take
// them, and the production build's scripts draw the pending snippet and branch first and the awaited
// values after. A page that awaits outside every boundary has no first frame, and draws once the
// background renders it. A page that calls `hydratable` has none either: Svelte refuses it outside
// async rendering, before it would serialize with `devalue`'s stand-in.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";

let production: AppBuild;
let development: AppBuild;
let unbounded: AppBuild;
let hydratable: AppBuild;

beforeAll(async () => {
	production = await buildApp("async");
	development = await buildApp("async", { development: true });
	unbounded = await buildApp("async", { entry: "./unbounded.ts" });
	hydratable = await buildApp("async", { entry: "./hydratable.ts" });
}, 720_000);
afterAll(() => {
	cleanBuild(production);
	cleanBuild(development);
	cleanBuild(unbounded);
	cleanBuild(hydratable);
});

describe("an app with Svelte's async mode on", () => {
	it("builds for production and for development, without a word", () => {
		expect([
			production.error + production.messages,
			development.error + development.messages,
			unbounded.error + unbounded.messages,
			hydratable.error + hydratable.messages,
		]).toEqual(["", "", "", ""]);
		expect([production.ok, development.ok, unbounded.ok, hydratable.ok]).toEqual([
			true,
			true,
			true,
			true,
		]);
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

	it("draws a page that calls hydratable once the background renders it, without devalue", async () => {
		const { page } = startDevicePage(scriptsOf(hydratable));
		try {
			expect(page.engine.texts()).toEqual([]);
			await page.settle();
			expect(page.engine.texts()).toEqual(["ready"]);
			// Svelte's own refusal, as the first frame reports a component that threw.
			expect(page.errors.map((error) => (error as { code?: unknown }).code)).toEqual([
				"first_frame_threw",
			]);
			expect(String(page.errors[0])).toContain("server_context_required");
		} finally {
			page.dispose();
		}
	});
});
