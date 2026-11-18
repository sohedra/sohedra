// UI methods and the flush: no UI before the tree is flushed, none for a layout-only view, and a
// view with an attribute answers whether Lynx flattens it or not. The layout-only shapes are those
// Lynx 4.2 answered on iOS and Android.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../../../src/testing/index.ts";
import { engineForEach, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();

/** A later macrotask: the engine answers a UI method on one, as the UI thread does. */
const nextTask = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Calls a UI method and returns what it answered, once it has. */
async function invoke(element: LynxElement) {
	const answers: unknown[] = [];
	engine().functions.__InvokeUIMethod(element, "boundingClientRect", {}, (result) =>
		answers.push(result),
	);
	await nextTask();
	return answers;
}

describe("a UI method", () => {
	it("has no UI for an element before the tree is flushed, then answers what the test says", async () => {
		const { page, inner } = smallPage(engine());
		engine().respondWith((method) => ({ code: 0, data: `${method} done` }));
		expect(await invoke(inner)).toEqual([{ code: 6 }]);
		engine().functions.__FlushElementTree(page);
		expect(await invoke(inner)).toEqual([{ code: 0, data: "boundingClientRect done" }]);
	});

	it("logs each call with the flushes before it, and what it answered", async () => {
		const { page, inner } = smallPage(engine());
		await invoke(inner);
		engine().functions.__FlushElementTree(page, { triggerLayout: true });
		await invoke(inner);
		expect(
			engine().invocations.map((call) => [
				call.element,
				call.method,
				call.flushesBefore,
				call.code,
			]),
		).toEqual([
			[inner, "boundingClientRect", 0, 6],
			[inner, "boundingClientRect", 1, 0],
		]);
		expect(engine().flushes).toEqual([{ triggerLayout: true }]);
	});

	it("is given the call by the test's responder, with the params and the element", () => {
		const { page, inner } = smallPage(engine());
		engine().functions.__FlushElementTree(page);
		const seen: unknown[] = [];
		engine().respondWith((method, params, element) => {
			seen.push([method, params, element]);
			return { code: 0 };
		});
		engine().functions.__InvokeUIMethod(inner, "setValue", { value: "a" }, () => {});
		expect(seen).toEqual([["setValue", { value: "a" }, inner]]);
	});

	it("is answered from the element as the last flush left it, not as it is now", () => {
		const { page, inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetClasses(inner, "before");
		f.__SetInlineStyles(inner, "width: 1px");
		f.__FlushElementTree(page);
		f.__SetClasses(inner, "after");
		f.__SetAttribute(inner, "title", "new");
		f.__AddInlineStyle(inner, "width", "2px");
		const seen: unknown[] = [];
		engine().respondWith((_method, _params, _element, shown) => {
			seen.push([shown?.classes, shown?.attrs["title"], shown?.inlineStyles.get("width")]);
			return { code: 0 };
		});
		f.__InvokeUIMethod(inner, "boundingClientRect", {}, () => {});
		f.__FlushElementTree(page);
		f.__InvokeUIMethod(inner, "boundingClientRect", {}, () => {});
		expect(seen).toEqual([
			["before", undefined, "1px"],
			["after", "new", "2px"],
		]);
	});

	it("answers on a later task, as the UI thread does, never during the call", async () => {
		const { page, inner } = smallPage(engine());
		engine().functions.__FlushElementTree(page);
		const answers: unknown[] = [];
		engine().functions.__InvokeUIMethod(inner, "boundingClientRect", {}, (result) =>
			answers.push(result),
		);
		expect(answers).toEqual([]);
		await nextTask();
		expect(answers).toEqual([{ code: 0 }]);
	});

	it("answers as the element was when it was called, not when the answer comes", async () => {
		const { page, inner } = smallPage(engine());
		const answers: unknown[] = [];
		engine().functions.__InvokeUIMethod(inner, "boundingClientRect", {}, (result) =>
			answers.push(result),
		);
		engine().functions.__FlushElementTree(page);
		await nextTask();
		expect(answers).toEqual([{ code: 6 }]);
	});

	it("is refused when the params are not an object, as the engine requires", () => {
		const { inner } = smallPage(engine());
		expect(() =>
			engine().functions.__InvokeUIMethod(inner, "boundingClientRect", null as never, () => {}),
		).toThrow("__InvokeUIMethod param 2 should be an object");
	});

	it("is refused when the callback is not a function", () => {
		const { inner } = smallPage(engine());
		expect(() =>
			engine().functions.__InvokeUIMethod(inner, "boundingClientRect", {}, undefined as never),
		).toThrow("__InvokeUIMethod param 3 should be a function");
	});
});

describe("an element that is not in the page at the flush", () => {
	it("gets no view, and has no UI until a flush finds it in the page", async () => {
		const { page } = smallPage(engine());
		const f = engine().functions;
		const loose = f.__CreateView(0);
		f.__SetID(loose, "loose");
		f.__FlushElementTree(page);
		expect(await invoke(loose)).toEqual([{ code: 6 }]);
		f.__AppendElement(page, loose);
		f.__FlushElementTree(page);
		expect(await invoke(loose)).toEqual([{ code: 0 }]);
	});
});

describe("a plain view", () => {
	const box = { left: 12, top: 200, width: 30, height: 40 };

	it("answers once the tree is flushed, flattened or not, as Lynx 4.2 does", async () => {
		const { page, outer, inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetAttribute(outer, "flatten", false);
		f.__FlushElementTree(page);
		engine().respondWith(() => ({ code: 0, data: box }));
		expect([...(await invoke(inner)), ...(await invoke(outer))]).toEqual([
			{ code: 0, data: box },
			{ code: 0, data: box },
		]);
	});

	it("answers at its place when it stops being flattened, before the next flush", async () => {
		const { page, inner } = smallPage(engine());
		engine().functions.__FlushElementTree(page);
		engine().respondWith(() => ({ code: 0, data: box }));
		engine().functions.__SetAttribute(inner, "flatten", false);
		expect(await invoke(inner)).toEqual([{ code: 0, data: box }]);
	});
});

describe("a layout-only view", () => {
	/** A view in the page with only layout styles and nothing else, flushed. */
	function layoutOnly() {
		const { page, outer } = smallPage(engine());
		const f = engine().functions;
		const view = f.__CreateView(0);
		f.__SetInlineStyles(view, "width: 10px; margin: 2px; display: flex; overflow: visible");
		f.__SetClasses(view, "row");
		f.__SetDataset(view, { row: 1 });
		f.__AppendElement(outer, view);
		f.__FlushElementTree(page);
		return { page, view };
	}

	it("has no UI after any number of flushes", async () => {
		const { page, view } = layoutOnly();
		engine().functions.__FlushElementTree(page);
		expect(await invoke(view)).toEqual([{ code: 6 }]);
	});

	it("has one from the flush after it gains an attribute, which it keeps", async () => {
		const { page, view } = layoutOnly();
		const f = engine().functions;
		f.__SetAttribute(view, "flatten", false);
		const answers = [...(await invoke(view))];
		f.__FlushElementTree(page);
		answers.push(...(await invoke(view)));
		f.__SetAttribute(view, "flatten", null);
		f.__FlushElementTree(page);
		answers.push(...(await invoke(view)));
		expect(answers).toEqual([{ code: 6 }, { code: 0 }, { code: 0 }]);
	});

	it.each([
		[
			"a custom property in the style text",
			(view: LynxElement) => engine().functions.__SetInlineStyles(view, "width: 10px; --x: red"),
		],
		[
			"a custom property added one by one",
			(view: LynxElement) => engine().functions.__AddInlineStyle(view, "--x", "red"),
		],
		[
			"a custom property set as an object",
			(view: LynxElement) => engine().functions.__SetInlineStyles(view, { "--x": "red" }),
		],
	])("still has none with %s, as on Lynx 4.2", async (_name, give) => {
		const { page, view } = layoutOnly();
		give(view);
		engine().functions.__FlushElementTree(page);
		expect(await invoke(view)).toEqual([{ code: 6 }]);
	});

	it.each([
		["an id", (view: LynxElement) => engine().functions.__SetID(view, "box")],
		["an id of none", (view: LynxElement) => engine().functions.__SetID(view, null)],
		[
			"a listener",
			(view: LynxElement) => engine().functions.__AddEventListener(view, "tap", () => {}, {}),
		],
		[
			"a main-thread function",
			(view: LynxElement) =>
				engine().functions.__AddEvent(view, "bindEvent", "tap", { type: "worklet", value: {} }),
		],
		[
			"a gesture detector",
			(view: LynxElement) =>
				engine().functions.__SetGestureDetector(
					view,
					1,
					0,
					{ callbacks: [] },
					{ waitFor: [], simultaneous: [], continueWith: [] },
				),
		],
		[
			"a style that is not layout",
			(view: LynxElement) => engine().functions.__AddInlineStyle(view, "background-color", "red"),
		],
		[
			"an overflow that is not visible",
			(view: LynxElement) => engine().functions.__AddInlineStyle(view, "overflow", "hidden"),
		],
		[
			"a fixed position",
			(view: LynxElement) => engine().functions.__AddInlineStyle(view, "position", "fixed"),
		],
	])("has one once %s is there at a flush", async (_name, give) => {
		const { page, view } = layoutOnly();
		give(view);
		engine().functions.__FlushElementTree(page);
		expect(await invoke(view)).toEqual([{ code: 0 }]);
	});

	it("has one straight in a scroll view, and keeps it there; further down it has none", async () => {
		const { page } = smallPage(engine());
		const f = engine().functions;
		const scroller = f.__CreateScrollView(0);
		f.__AppendElement(page, scroller);
		const [child, grandchild] = [f.__CreateView(0), f.__CreateView(0)];
		f.__AppendElement(scroller, child);
		f.__AppendElement(child, grandchild);
		f.__FlushElementTree(page);
		expect([...(await invoke(child)), ...(await invoke(grandchild))]).toEqual([
			{ code: 0 },
			{ code: 6 },
		]);
	});

	it("keeps the UI a scroll view gave it once it is taken out, flushed there or not", async () => {
		const { page, outer } = smallPage(engine());
		const f = engine().functions;
		const scroller = f.__CreateScrollView(0);
		f.__AppendElement(page, scroller);
		const view = f.__CreateView(0);
		f.__AppendElement(scroller, view);
		f.__RemoveElement(scroller, view);
		f.__AppendElement(outer, view);
		f.__FlushElementTree(page);
		expect(await invoke(view)).toEqual([{ code: 0 }]);
	});

	it("has none in an element tagged scroll-view that __CreateScrollView did not make", async () => {
		const { page } = smallPage(engine());
		const f = engine().functions;
		const scroller = f.__CreateElement("scroll-view", 0);
		f.__AppendElement(page, scroller);
		const view = f.__CreateView(0);
		f.__AppendElement(scroller, view);
		f.__FlushElementTree(page);
		expect(await invoke(view)).toEqual([{ code: 6 }]);
	});

	it("is a view only: an element of another tag has a UI", async () => {
		const { page, outer } = smallPage(engine());
		const f = engine().functions;
		const text = f.__CreateText(0);
		f.__AppendElement(outer, text);
		f.__FlushElementTree(page);
		expect(await invoke(text)).toEqual([{ code: 0 }]);
	});
});
