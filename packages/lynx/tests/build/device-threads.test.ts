// A small page built for production and for development, run on threads shaped like a device's
// (device-threads.ts): the built scripts start the page, draw it and take a tap with only what a
// device gives them. A device runs a development build from the dev server, whose client needs the
// host's native modules for its socket and DevTool; the development build here leaves that client
// out (no hot or live reload), and keeps the binding's and Svelte's development paths.

import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { buildApp, cleanBuild, scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { startDevicePage, SYSTEM_INFO } from "./device-threads.ts";

const MODES = ["production", "development"] as const;
const builds = new Map<(typeof MODES)[number], AppBuild>();

beforeAll(async () => {
	for (const mode of MODES)
		builds.set(
			mode,
			await buildApp("device", {
				development: mode === "development",
				rsbuild: { dev: { hmr: false, liveReload: false } },
			}),
		);
}, 360_000);
afterAll(() => {
	for (const build of builds.values()) cleanBuild(build);
});

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

describe.each(MODES)("a page built for %s, on threads shaped like a device's", (mode) => {
	let scripts: ReturnType<typeof scriptsOf>;
	beforeAll(() => {
		const build = builds.get(mode)!;
		if (build.ok) scripts = scriptsOf(build);
	});

	it("builds", () => {
		const build = builds.get(mode)!;
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("starts and draws the page, reporting nothing", async () => {
		const { page } = startDevicePage(scripts);
		try {
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(drawn(page)).toEqual({
				texts: ["Tapped 0, seen 0", "Pressed 0", "Apple", "Banana"],
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
				texts: ["Tapped 1, seen 1", "Pressed 0", "Banana", "Apple"],
				padding: "8px",
				opacity: "0.5",
			});
		} finally {
			page.dispose();
		}
	});

	it("runs a main-thread tap on the main thread, and its call of the background", async () => {
		const { page } = startDevicePage(scripts);
		try {
			await page.settle();
			const press = byClass(page, "press");
			page.engine.dispatch(press, { type: "tap" });
			page.engine.dispatch(press, { type: "tap" });
			expect(page.engine.state(press).inlineStyles.get("width")).toBe("2px");
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(drawn(page).texts).toContain("Pressed 2");
		} finally {
			page.dispose();
		}
	});

	it("fills in the background's global queueMicrotask from lynx, and no timers", () => {
		const { page, background } = startDevicePage(scripts);
		try {
			const kinds = vm.runInContext("[typeof queueMicrotask, typeof setTimeout]", background);
			expect(kinds).toEqual(["function", "undefined"]);
		} finally {
			page.dispose();
		}
	});

	it("runs the main thread with no global queueMicrotask, as on a device", async () => {
		const { page, mainThread } = startDevicePage(scripts);
		try {
			await page.settle();
			expect(vm.runInContext("typeof queueMicrotask", mainThread)).toBe("undefined");
			expect(page.errors.map(String)).toEqual([]);
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

	it("fills in the main thread's replaceAll, which the first frame's style: path calls", () => {
		const { page, mainThread } = startDevicePage(scripts);
		try {
			expect(vm.runInContext('typeof "".replaceAll', mainThread)).toBe("function");
		} finally {
			page.dispose();
		}
	});

	it("hands the main thread the element functions' answers as its own", () => {
		const { page, mainThread } = startDevicePage(scripts);
		try {
			const at = page.asMainThread(() =>
				vm.runInContext("typeof __QuerySelectorAll(__GetPageElement(), 'view', {}).at", mainThread),
			);
			expect(at).toBe("undefined");
		} finally {
			page.dispose();
		}
	});
});
