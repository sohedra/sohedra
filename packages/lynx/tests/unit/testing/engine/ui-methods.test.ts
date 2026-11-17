// UI methods and the flush: no UI before the tree is flushed, flattened views have none, and an
// element that stopped being flattened answers as it was until the next flush.

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
		engine().flattenViews(false);
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

describe("a plain view", () => {
	it("has no UI once flattening is on, until it is told it has one of its own", async () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__FlushElementTree(page);
		expect(await invoke(inner)).toEqual([{ code: 6 }]);
		engine().functions.__SetAttribute(inner, "flatten", false);
		engine().functions.__FlushElementTree(page);
		expect(await invoke(inner)).toEqual([{ code: 0 }]);
	});

	it("does not take a view of another tag as flattened", async () => {
		const { page, inner, outer } = smallPage(engine());
		const f = engine().functions;
		const scroller = f.__CreateScrollView(0);
		f.__AppendElement(outer, scroller);
		engine().flattenViews();
		f.__FlushElementTree(page);
		expect(await invoke(scroller)).toEqual([{ code: 0 }]);
		expect(await invoke(inner)).toEqual([{ code: 6 }]);
	});

	it("has a view of its own with a listener", async () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__AddEventListener(inner, "tap", () => {}, {});
		engine().functions.__FlushElementTree(page);
		expect(await invoke(inner)).toEqual([{ code: 0 }]);
	});

	it("has a view of its own with a main-thread function", async () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__AddEvent(inner, "bindEvent", "tap", { type: "worklet", value: {} });
		engine().functions.__FlushElementTree(page);
		expect(await invoke(inner)).toEqual([{ code: 0 }]);
	});
});

describe("an element that stopped being flattened", () => {
	it("answers as the flattened element until the tree is flushed, then rightly", async () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__FlushElementTree(page);
		engine().respondWith(() => ({ code: 0, data: { left: 12, top: 200, width: 30, height: 40 } }));
		const answers = [...(await invoke(inner))];
		engine().functions.__SetAttribute(inner, "flatten", false);
		answers.push(...(await invoke(inner)));
		engine().functions.__FlushElementTree(page);
		answers.push(...(await invoke(inner)));
		expect(answers).toEqual([
			{ code: 6 },
			{ code: 0, data: { left: 0, top: 0, width: 30, height: 40 } },
			{ code: 0, data: { left: 12, top: 200, width: 30, height: 40 } },
		]);
		expect(engine().invocations.map((call) => call.code)).toEqual([6, 0, 0]);
	});
});
