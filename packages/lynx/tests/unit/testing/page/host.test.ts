// The host on a test page: lynx-core's `GlobalEventEmitter`, the host's global props reaching both
// threads, and the lazy bundles the page serves to each thread's `fetchBundle` and `loadScript`.

import { describe, expect, it } from "@rstest/core";

import { installGlobals, readGlobal } from "../../../../src/testing/globals.ts";
import { startTestPage as startPage } from "../../../../src/testing/index.ts";
import type { TestPageOptions } from "../../../../src/testing/index.ts";

/** A test page whose main thread hears the render, so that the page reports nothing of its own. */
function startTestPage(options: TestPageOptions = {}) {
	return startPage({
		...options,
		mainThread: () => {
			installGlobals({ renderPage: () => {} });
			options.mainThread?.();
		},
	});
}

describe("the host's events", () => {
	it("reach the background's listeners on a later task, with their arguments", async () => {
		const page = startTestPage();
		const emitter = page.lynx.background.getJSModule("GlobalEventEmitter");
		const heard: unknown[] = [];
		emitter.addListener("onWindowResize", (...args) => {
			heard.push(args, readGlobal("lynx") === page.lynx.background);
		});
		page.emitHostEvent("onWindowResize", [390, 844]);
		expect(heard).toEqual([]);
		await page.settle();
		expect(heard).toEqual([[390, 844], true]);
	});

	it("call a listener added twice twice, and a removal takes one", async () => {
		const page = startTestPage();
		const emitter = page.lynx.background.getJSModule("GlobalEventEmitter");
		let calls = 0;
		const hear = () => void calls++;
		emitter.addListener("cartchanged", hear);
		emitter.addListener("cartchanged", hear);
		expect(page.hostEvents.listeners("cartchanged")).toBe(2);
		emitter.removeListener("cartchanged", hear);
		page.emitHostEvent("cartchanged", []);
		await page.settle();
		expect(calls).toBe(1);
		expect(() => emitter.removeListener("cartchanged", "x" as never)).toThrow(/Function/);
	});

	it("send switchKeyBoardDetect(true) at each listener of the keyboard, and false at each removal", () => {
		const page = startTestPage();
		const emitter = page.lynx.background.getJSModule("GlobalEventEmitter");
		const hear = () => {};
		emitter.addListener("keyboardstatuschanged", hear);
		emitter.addListener("keyboardstatuschanged", () => {});
		emitter.removeListener("keyboardstatuschanged", hear);
		emitter.addListener("onWindowResize", hear);
		expect(page.hostEvents.keyboardDetection).toEqual([true, true, false]);
	});

	it("count what the page asked lynx-core, and refuse a module it does not know", () => {
		const page = startTestPage();
		expect(page.hostEvents.asked).toBe(0);
		page.lynx.background.getJSModule("GlobalEventEmitter");
		expect(page.hostEvents.asked).toBe(1);
		expect(() => page.lynx.background.getJSModule("NativeModules")).toThrow(/not checked/);
	});

	it("keep what a listener throws, as lynx-core reports it", async () => {
		const page = startTestPage();
		const failure = new Error("the listener threw");
		page.lynx.background.getJSModule("GlobalEventEmitter").addListener("cartchanged", () => {
			throw failure;
		});
		page.emitHostEvent("cartchanged", []);
		await page.settle();
		expect(page.errors).toEqual([failure]);
	});
});

describe("the host's global props", () => {
	it("reach the main thread with the ones it had, then the app's hook on the background", async () => {
		const calls: unknown[] = [];
		const page = startTestPage({
			globalProps: { theme: "light", locale: "en" },
			mainThread: () =>
				installGlobals({
					updateGlobalProps: (props: unknown, options: unknown) =>
						calls.push(["main thread", props, options]),
				}),
		});
		page.app["updateGlobalProps"] = (props: unknown) => calls.push(["background", props]);
		page.updateGlobalProps({ theme: "dark" });
		const merged = { theme: "dark", locale: "en" };
		expect(page.lynx.mainThread.__globalProps).toEqual(merged);
		expect(calls).toEqual([["main thread", merged, {}]]);
		await page.settle();
		expect(calls).toEqual([
			["main thread", merged, {}],
			["background", merged],
		]);
	});
});

describe("lazy bundles", () => {
	const URL = "http://localhost:3002/lazy-bundle/Heavy.bundle";

	it("answer the background's fetch on a later task, and run its section", async () => {
		const page = startTestPage({ bundles: { [URL]: { background: () => "chunk" } } });
		const answers: unknown[] = [];
		page.lynx.background.fetchBundle(URL, {}).then((answer) => answers.push(answer));
		expect(answers).toEqual([]);
		await page.settle();
		expect(answers).toEqual([{ code: 0, url: URL, error_msg: "" }]);
		expect(page.lynx.background.loadScript("background", { bundleName: URL })).toBe("chunk");
		expect(page.errors).toEqual([]);
	});

	it("answer a fetch that failed with its code, which Lynx reports", async () => {
		const page = startTestPage({
			bundles: { [URL]: { code: 1601, message: "Failed to connect" } },
		});
		const answers: unknown[] = [];
		page.lynx.background.fetchBundle(URL, {}).then((answer) => answers.push(answer));
		await page.settle();
		expect(answers).toEqual([{ code: 1601, url: URL, error_msg: "Failed to connect" }]);
		expect(page.errors.map(String)).toEqual([
			`Error: Lynx could not load the bundle ${URL}: Failed to connect`,
		]);
	});

	it("answer the main thread's wait at once, and its section and styles", () => {
		const styles = { sheet: "heavy" };
		const section = () => ({});
		const page = startTestPage({ bundles: { [URL]: { mainThread: () => section, styles } } });
		const { mainThread } = page.lynx;
		expect(mainThread.fetchBundle(URL, {}).wait(5)).toEqual({ code: 0, url: URL, error_msg: "" });
		expect(mainThread.loadScript("main-thread", { bundleName: URL })).toBe(section);
		expect(page.engine.functions.__LoadStyleSheet("CSS", URL)).toBe(styles);
	});

	it("throw for an empty section, as the engine does, and for a URL the page does not serve", () => {
		const page = startTestPage({ bundles: { [URL]: {} } });
		expect(() => page.lynx.mainThread.loadScript("main-thread", { bundleName: URL })).toThrow(
			"lynx.loadScript's script is empty.key: main-thread",
		);
		expect(() => page.lynx.background.fetchBundle("http://elsewhere/x.bundle", {})).toThrow(
			/serves no bundle at http:\/\/elsewhere\/x\.bundle/,
		);
	});
});

describe("what Lynx says about the device", () => {
	it("is the background's global SystemInfo and the main thread's lynx.SystemInfo", () => {
		const info = { platform: "Android" };
		const page = startTestPage({ systemInfo: info });
		expect(page.lynx.mainThread.SystemInfo).toBe(info);
		expect(page.asBackground(() => readGlobal("SystemInfo"))).toBe(info);
	});

	it("is an iPhone's by default", () => {
		const page = startTestPage();
		expect(page.lynx.mainThread.SystemInfo).toMatchObject({ platform: "iOS", pixelRatio: 3 });
	});
});
