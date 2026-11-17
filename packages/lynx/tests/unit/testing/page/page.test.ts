// A test page: the engine fake as the main thread's globals, a `lynx` for each thread, and the two
// places where the page's own scripts start. No runtime runs in their place.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../../../src/testing/globals.ts";
import { startTestPage } from "../../../../src/testing/index.ts";
import type { BackgroundLynx, MainThreadLynx } from "../../../../src/testing/index.ts";

/** Calls an element function as the main thread's script does: through its global. */
const mainThreadCall = (name: string, ...args: unknown[]): unknown =>
	(readGlobal(name) as (...args: unknown[]) => unknown)(...args);

/** The `lynx` a script reads while its thread runs: a global. */
const lynx = () => readGlobal("lynx");

// Every element function the main-thread runtime calls: the names its element-function table
// required and took when present, and the ones its element methods and lazy bundles call.
const CALLED_BY_THE_MAIN_THREAD = [
	"__CreatePage",
	"__GetElementUniqueID",
	"__CreateView",
	"__CreateText",
	"__CreateImage",
	"__CreateScrollView",
	"__CreateElement",
	"__AppendElement",
	"__InsertElementBefore",
	"__RemoveElement",
	"__SetAttribute",
	"__SetClasses",
	"__SetInlineStyles",
	"__SetID",
	"__SetDataset",
	"__AddEventListener",
	"__RemoveEventListener",
	"__FlushElementTree",
	"__InvokeUIMethod",
	"__AddInlineStyle",
	"__GetComputedStyleByKey",
	"__QuerySelector",
	"__QuerySelectorAll",
	"__ElementAnimate",
	"__CreateList",
	"__UpdateListCallbacks",
	"__AddEvent",
	"__SetGestureDetector",
	"__RemoveGestureDetector",
	"__GetAttributeByName",
	"__GetAttributeNames",
	"__GetPageElement",
	"__LoadStyleSheet",
	"__AdoptStyleSheet",
];

describe("a test page", () => {
	it("puts every element function the main thread calls on the main thread's globals", () => {
		const page = startTestPage();
		const missing = page.asMainThread(() =>
			CALLED_BY_THE_MAIN_THREAD.filter(
				(name) =>
					readGlobal(name) !== (page.engine.functions as unknown as Record<string, unknown>)[name],
			),
		);
		expect(missing).toEqual([]);
	});

	it("gives each thread a lynx with the page's data, and the main thread's the engine's events", () => {
		const page = startTestPage({ initData: { count: 1 }, globalProps: { theme: "dark" } });
		for (const own of [page.lynx.mainThread, page.lynx.background]) {
			expect(own.__initData).toEqual({ count: 1 });
			expect(own.__globalProps).toEqual({ theme: "dark" });
		}
		expect(page.lynx.mainThread.getEngine()).toBe(page.engine.lifecycle.engine);
		expect(page.lynx.mainThread.getNative()).toBe(page.engine.lifecycle.native);
	});

	it("keeps what either thread reports with lynx.reportError", () => {
		const page = startTestPage();
		const errors = [new Error("main"), new Error("background")];
		page.lynx.mainThread.reportError(errors[0]);
		page.lynx.background.reportError(errors[1]);
		expect(page.errors).toEqual(expect.arrayContaining(errors));
	});

	it("reports a render that nothing hears, as Lynx calls a renderPage the main thread lacks", () => {
		const page = startTestPage();
		expect(page.errors).toContainEqual(
			expect.objectContaining({ message: expect.stringContaining("renderPage") }),
		);
	});

	it("reports nothing for a render that the main thread's script listens for", () => {
		const page = startTestPage({
			mainThread: () =>
				(lynx() as MainThreadLynx).getEngine().addEventListener("__RenderPage", () => undefined),
		});
		expect(page.errors).toEqual([]);
	});

	it("runs the main thread's script, renders, then runs the background's script, each with its lynx", () => {
		const order: string[] = [];
		const seen: unknown[] = [];
		const page = startTestPage({
			initData: { count: 1 },
			mainThread: () => {
				order.push("main thread");
				seen.push(lynx());
				(lynx() as MainThreadLynx)
					.getEngine()
					.addEventListener("__RenderPage", (event) =>
						order.push(`render ${JSON.stringify(event.data)}`),
					);
			},
			background: () => {
				order.push("background");
				seen.push(lynx());
			},
		});
		expect(order).toEqual(["main thread", 'render [{"count":1},{}]', "background"]);
		expect(page.engine.flushes).toHaveLength(1);
		expect(seen).toEqual([page.lynx.mainThread, page.lynx.background]);
	});

	it("runs no script of its own when none is given: nothing stands in for the runtime", () => {
		const page = startTestPage();
		expect(page.engine.page()).toBeUndefined();
		expect(readGlobal("runWorklet")).toBeUndefined();
		expect(document.body.childNodes).toHaveLength(0);
	});

	it("puts the process back when it ends: the globals, the document, and the page's end said", () => {
		const before = readGlobal("lynx");
		const page = startTestPage({
			mainThread: () => mainThreadCall("__CreatePage", "0", 0),
		});
		const ended: unknown[] = [];
		page.engine.lifecycle.native.addEventListener("__DestroyLifetime", (event) =>
			ended.push(event),
		);
		page.dispose();
		expect(ended).toHaveLength(1);
		expect(readGlobal("lynx")).toBe(before);
		expect(readGlobal("__CreateView")).toBeUndefined();
		expect(document.body.childNodes).toHaveLength(0);
	});

	it("ends the page before it when a test starts another", () => {
		const first = startTestPage();
		const ended: unknown[] = [];
		first.engine.lifecycle.native.addEventListener("__DestroyLifetime", (event) =>
			ended.push(event),
		);
		const second = startTestPage();
		expect(ended).toHaveLength(1);
		expect(second.asMainThread(() => readGlobal("__CreateView"))).toBe(
			second.engine.functions.__CreateView,
		);
	});
});

// Two tests in order: the preset's setup file ends the page the first one started.
describe("a test run through the preset", () => {
	it("starts a page and leaves it running", () => {
		startTestPage({ mainThread: () => mainThreadCall("__CreatePage", "0", 0) });
		expect(readGlobal("lynx")).toBeDefined();
		expect(document.body.childNodes).toHaveLength(1);
	});

	it("finds it ended in the next test, with the process put back", () => {
		expect(readGlobal("lynx")).toBeUndefined();
		expect(readGlobal("__CreateView")).toBeUndefined();
		expect(document.body.childNodes).toHaveLength(0);
	});
});

describe("a test page's threads", () => {
	it("keep Lynx's element functions off the background, as a device has none there", async () => {
		const seen: Record<string, unknown> = {};
		const page = startTestPage({
			mainThread: () => (seen["main thread"] = readGlobal("__CreateView")),
			background: () => (seen["background"] = readGlobal("__CreateView")),
		});
		expect(seen["main thread"]).toBe(page.engine.functions.__CreateView);
		expect(seen["background"]).toBeUndefined();
		expect(page.asMainThread(() => readGlobal("__CreateView"))).toBe(
			page.engine.functions.__CreateView,
		);
		expect(page.asBackground(() => readGlobal("__CreateView"))).toBeUndefined();
	});

	it("run a background microtask as the background, with its lynx", async () => {
		const page = startTestPage();
		const seen: unknown[] = [];
		page.lynx.background.queueMicrotask(() => seen.push(readGlobal("lynx")));
		page.asMainThread(() => undefined);
		await Promise.resolve();
		expect(seen).toEqual([page.lynx.background]);
	});

	it("keep a report at the warning level apart from the errors", () => {
		const page = startTestPage();
		const warning = new Error("warning");
		page.lynx.background.reportError(warning, { level: "warning" });
		expect(page.warnings).toEqual([warning]);
		expect(page.errors).not.toContain(warning);
	});
});

describe("the app on the background", () => {
	/** Records each hook the engine calls, with the thread it ran as. */
	function recording() {
		const calls: string[] = [];
		const page = startTestPage({
			initData: { a: 1 },
			mainThread: () =>
				(lynx() as MainThreadLynx)
					.getEngine()
					.addEventListener("__UpdatePage", (event) =>
						calls.push(`main thread __UpdatePage ${JSON.stringify(event.data)}`),
					),
			background: () => {
				const app = (lynx() as BackgroundLynx).getApp();
				for (const hook of ["updateCardData", "onAppReload", "callDestroyLifetimeFun"])
					app[hook] = (...args: unknown[]) =>
						calls.push(
							`${lynx() === page.lynx.background ? "background" : "?"} ${hook} ${JSON.stringify(args)}`,
						);
			},
		});
		return { page, calls };
	}

	it("keeps the data the page was opened with", () => {
		const page = startTestPage({ initData: { a: 1 } });
		expect(page.app._params).toEqual({ initData: { a: 1 }, updateData: {} });
		expect(page.lynx.background.getApp()).toBe(page.app);
	});

	it("hears new data after the main thread, with its type", async () => {
		const { page, calls } = recording();
		page.updateData({ b: 2 }, { type: 1 });
		expect(calls).toEqual(['main thread __UpdatePage [{"b":2},{}]']);
		await page.settle();
		expect(calls.at(-1)).toBe('background updateCardData [{"b":2},{"type":1}]');
	});

	it("hears a reload after the main thread has updated with reloadTemplate", async () => {
		const { page, calls } = recording();
		page.reload({ c: 3 });
		expect(calls).toEqual(['main thread __UpdatePage [{"c":3},{"reloadTemplate":true}]']);
		await page.settle();
		expect(calls.at(-1)).toBe('background onAppReload [{"c":3}]');
	});

	it("hears the end of the page's life after the main thread, once, also when the page is disposed", async () => {
		const { page, calls } = recording();
		page.destroy();
		await page.settle();
		page.dispose();
		expect(calls).toEqual(["background callDestroyLifetimeFun []"]);
		const second = recording();
		second.page.dispose();
		expect(second.calls).toEqual(["background callDestroyLifetimeFun []"]);
	});

	it("skips a hook the page did not put there, as the engine does", async () => {
		const page = startTestPage();
		page.updateData({ b: 2 });
		page.reload();
		await page.settle();
		// Only the engine's own reports of the main thread's missing functions: none of the app's.
		expect(page.errors).toHaveLength(3);
		for (const error of page.errors)
			expect(error).toMatchObject({
				message: expect.stringMatching(/^The engine sent __(Render|Update)Page/),
			});
	});
});
