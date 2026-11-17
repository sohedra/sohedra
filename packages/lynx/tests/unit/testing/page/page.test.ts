// A test page: the engine fake as the main thread's globals, the fake `lynx` both threads read,
// and the two places where the page's own scripts start. No runtime runs in their place.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../../../src/testing/globals.ts";
import { startTestPage } from "../../../../src/testing/index.ts";
import type { TestLynx } from "../../../../src/testing/index.ts";

/** The page's `lynx`, as each thread's code reads it: a global. */
const lynx = () => readGlobal("lynx") as TestLynx;

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
		const missing = CALLED_BY_THE_MAIN_THREAD.filter(
			(name) =>
				readGlobal(name) !== (page.engine.functions as unknown as Record<string, unknown>)[name],
		);
		expect(missing).toEqual([]);
	});

	it("gives both threads one lynx, with the page's data, its contexts and the engine's", () => {
		const page = startTestPage({ initData: { count: 1 }, globalProps: { theme: "dark" } });
		const shared = lynx();
		expect(shared.__initData).toEqual({ count: 1 });
		expect(shared.__globalProps).toEqual({ theme: "dark" });
		expect(shared.getEngine()).toBe(page.engine.lifecycle.engine);
		expect(shared.getNative()).toBe(page.engine.lifecycle.native);
		for (const name of ["getJSContext", "getCoreContext", "getNativeApp", "reportError"] as const) {
			expect(typeof shared[name]).toBe("function");
		}
	});

	it("keeps what the page reports with lynx.reportError", () => {
		const page = startTestPage();
		const error = new Error("boom");
		lynx().reportError(error);
		expect(page.errors).toEqual([error]);
	});

	it("runs the main thread's script, renders, then runs the background's script", () => {
		const order: string[] = [];
		const page = startTestPage({
			initData: { count: 1 },
			mainThread: () => {
				order.push("main thread");
				lynx()
					.getEngine()
					.addEventListener("__RenderPage", (event) =>
						order.push(`render ${JSON.stringify(event.data)}`),
					);
			},
			background: () => order.push(`background, ${page.engine.flushes.length} flush`),
		});
		expect(order).toEqual(["main thread", 'render [{"count":1},{}]', "background, 1 flush"]);
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
			mainThread: () => {
				page.engine.functions.__CreatePage("0", 0);
			},
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
		expect(readGlobal("__CreateView")).toBe(second.engine.functions.__CreateView);
	});
});

// Two tests in order: the preset's setup file ends the page the first one started.
describe("a test run through the preset", () => {
	it("starts a page and leaves it running", () => {
		const page = startTestPage({
			mainThread: () => {
				page.engine.functions.__CreatePage("0", 0);
			},
		});
		expect(readGlobal("lynx")).toBeDefined();
		expect(document.body.childNodes).toHaveLength(1);
	});

	it("finds it ended in the next test, with the process put back", () => {
		expect(readGlobal("lynx")).toBeUndefined();
		expect(readGlobal("__CreateView")).toBeUndefined();
		expect(document.body.childNodes).toHaveLength(0);
	});
});
