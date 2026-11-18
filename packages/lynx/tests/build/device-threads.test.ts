// A production build of a small page, run on threads shaped like a device's (device-threads.ts):
// the built scripts start the page, draw it and take a tap with only what a device gives them.

import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { buildApp, cleanBuild, scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { startDevicePage, SYSTEM_INFO } from "./device-threads.ts";

let build: AppBuild;
let scripts: ReturnType<typeof scriptsOf>;

beforeAll(async () => {
	build = await buildApp("device");
	if (build.ok) scripts = scriptsOf(build);
}, 180_000);
afterAll(() => cleanBuild(build));

/** The first element with this class token. */
function byClass(page: TestPage, token: string): LynxElement {
	const found = page.engine
		.all()
		.find((element) => page.engine.state(element).classes.split(" ").includes(token));
	if (!found) throw new Error(`No element has the class ${token}.`);
	return found;
}

/** The page's texts and the page element's inline styles. */
function drawn(page: TestPage) {
	const styles = page.engine.state(byClass(page, "page")).inlineStyles;
	return {
		texts: page.engine.texts(),
		padding: styles.get("padding"),
		opacity: styles.get("opacity"),
	};
}

describe("a built page on threads shaped like a device's", () => {
	it("builds", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("starts and draws the page, reporting nothing", async () => {
		const { page } = startDevicePage(scripts);
		try {
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(drawn(page)).toEqual({
				texts: ["Tapped 0", "Apple", "Banana"],
				padding: "8px",
				opacity: "1",
			});
		} finally {
			page.dispose();
		}
	});

	it("runs a tap on the background, and the main thread draws what it changed", async () => {
		const { page } = startDevicePage(scripts);
		try {
			await page.settle();
			page.engine.dispatch(byClass(page, "button"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(drawn(page)).toEqual({
				texts: ["Tapped 1", "Banana", "Apple"],
				padding: "8px",
				opacity: "0.5",
			});
		} finally {
			page.dispose();
		}
	});

	it("fills in the background's global timers and queueMicrotask from lynx", async () => {
		const { page, background } = startDevicePage(scripts);
		try {
			const kinds = vm.runInContext(
				"[setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask].map((fn) => typeof fn)",
				background,
			);
			expect(kinds).toEqual(["function", "function", "function", "function", "function"]);
			const later: Promise<string> = vm.runInContext(
				"new Promise((resolve) => setTimeout(() => resolve('later'), 1))",
				background,
			);
			expect(await later).toBe("later");
		} finally {
			page.dispose();
		}
	});

	it("fills in the main thread's global SystemInfo from lynx", () => {
		const { page, mainThread } = startDevicePage(scripts);
		try {
			expect(vm.runInContext("SystemInfo", mainThread)).toBe(SYSTEM_INFO);
		} finally {
			page.dispose();
		}
	});
});
