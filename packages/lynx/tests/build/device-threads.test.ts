// A small page built for production and for development, run on threads shaped like a device's
// (device-threads.ts): the built scripts start the page, draw it and take a tap with only what a
// device gives them. A device runs a development build from the dev server, whose client needs the
// host's native modules for its socket and DevTool; the development build here leaves that client
// out (no hot or live reload), and keeps the binding's and Svelte's development paths.

import vm from "node:vm";

import { beforeAll, describe, expect, it } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { startDevicePage, SYSTEM_INFO } from "./device-threads.ts";
import { sharedBuild } from "./shared-build.ts";

const MODES = ["production", "development"] as const;
const builds = new Map<(typeof MODES)[number], AppBuild>();

beforeAll(async () => {
	for (const mode of MODES) builds.set(mode, await sharedBuild(mode, "device"));
}, 360_000);

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
			expect(drawn(page).texts).toContain("Pressed 2 (Apple, 0)");
		} finally {
			page.dispose();
		}
	});

	it("gives a main-thread tap the state the background changed inside", async () => {
		const { page } = startDevicePage(scripts);
		try {
			await page.settle();
			page.engine.dispatch(byClass(page, "button"), { type: "tap" });
			await page.settle();
			page.engine.dispatch(byClass(page, "press"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(drawn(page).texts).toContain("Pressed 1 (Banana, 1)");
		} finally {
			page.dispose();
		}
	});

	it("runs a pan's callback on the main thread with its state manager, and its call of the background", async () => {
		const { page } = startDevicePage(scripts);
		try {
			await page.settle();
			const drag = byClass(page, "drag");
			const [detector] = page.engine.detectors(drag);
			expect(detector).toMatchObject({ type: 0, config: { minDistance: 4 } });
			page.engine.fireGesture(drag, { id: detector!.id, callback: "onUpdate", params: { y: 7 } });
			expect(page.engine.state(drag).inlineStyles.get("height")).toBe("7px");
			expect(page.engine.detectors(drag)[0]!.state).toBe(1);
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(drawn(page).texts).toContain("Pressed 1");
		} finally {
			page.dispose();
		}
	});

	it("sends a gesture's waitFor to the engine, and warns once that it is experimental in development only", async () => {
		const { page } = startDevicePage(scripts);
		try {
			await page.settle();
			const [pan] = page.engine.detectors(byClass(page, "drag"));
			const [wait] = page.engine.detectors(byClass(page, "wait"));
			expect(wait!.relations).toEqual({ waitFor: [pan!.id], simultaneous: [], continueWith: [] });
			expect(page.errors.map(String)).toEqual([]);
			expect(page.warnings).toEqual(
				mode === "development"
					? [
							expect.objectContaining({
								code: "gesture_relation_experimental",
								message: expect.stringMatching(/^The waitFor of a TapGesture is experimental/),
							}),
						]
					: [],
			);
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

	it("fills in the main thread's global queueMicrotask, which a device lacks, with one that runs", async () => {
		const { page, mainThread } = startDevicePage(scripts);
		try {
			await page.settle();
			expect(vm.runInContext("typeof queueMicrotask", mainThread)).toBe("function");
			const ran = vm.runInContext(
				"new Promise((resolve) => queueMicrotask(() => resolve('ran')))",
				mainThread,
			) as Promise<string>;
			await expect(ran).resolves.toBe("ran");
			expect(page.errors.map(String)).toEqual([]);
		} finally {
			page.dispose();
		}
	});

	it("copies a main-thread tap's captured state without Svelte's snapshot or structuredClone", async () => {
		const calls: string[] = [];
		// Svelte's snapshot tests every value with `instanceof EventTarget`.
		class EventTarget {
			static [Symbol.hasInstance](): boolean {
				calls.push("instanceof EventTarget");
				return false;
			}
		}
		const structuredClone = (value: unknown) => {
			calls.push("structuredClone");
			return value;
		};
		const { page } = startDevicePage(scripts, { globals: { EventTarget, structuredClone } });
		try {
			await page.settle();
			page.engine.dispatch(byClass(page, "button"), { type: "tap" });
			await page.settle();
			page.engine.dispatch(byClass(page, "press"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(drawn(page).texts).toContain("Pressed 1 (Banana, 1)");
			expect(calls).toEqual([]);
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

describe("a page built for production that copies nothing", () => {
	it("carries none of createStaticCopy's code on either thread", () => {
		const build = builds.get("production")!;
		expect(build.ok).toBe(true);
		const scripts = scriptsOf(build);
		// A name only the copy's code reads, which minifying keeps.
		expect(scripts.background).not.toContain("keepIds");
		expect(scripts.mainThread).not.toContain("keepIds");
	});
});
