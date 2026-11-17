// UI methods and the flush: no UI before the tree is flushed, flattened views have none, and an
// element that stopped being flattened answers as it was until the next flush.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../../../src/testing/index.ts";
import { engineForEach, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();

/** Calls a UI method and returns what it answered. */
function invoke(element: LynxElement) {
	const answers: unknown[] = [];
	engine().functions.__InvokeUIMethod(element, "boundingClientRect", {}, (result) =>
		answers.push(result),
	);
	return answers;
}

describe("a UI method", () => {
	it("has no UI for an element before the tree is flushed, then answers what the test says", () => {
		const { page, inner } = smallPage(engine());
		engine().respondWith((method) => ({ code: 0, data: `${method} done` }));
		engine().flattenViews(false);
		expect(invoke(inner)).toEqual([{ code: 6 }]);
		engine().functions.__FlushElementTree(page);
		expect(invoke(inner)).toEqual([{ code: 0, data: "boundingClientRect done" }]);
	});

	it("logs each call with the flushes before it, and what it answered", () => {
		const { page, inner } = smallPage(engine());
		invoke(inner);
		engine().functions.__FlushElementTree(page, { triggerLayout: true });
		invoke(inner);
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

	it("is refused when the callback is not a function", () => {
		const { inner } = smallPage(engine());
		expect(() =>
			engine().functions.__InvokeUIMethod(inner, "boundingClientRect", {}, undefined as never),
		).toThrow("__InvokeUIMethod param 3 should be a function");
	});
});

describe("a plain view", () => {
	it("has no UI once flattening is on, until it is told it has one of its own", () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__FlushElementTree(page);
		expect(invoke(inner)).toEqual([{ code: 6 }]);
		engine().functions.__SetAttribute(inner, "flatten", false);
		engine().functions.__FlushElementTree(page);
		expect(invoke(inner)).toEqual([{ code: 0 }]);
	});

	it("does not take a view of another tag as flattened", () => {
		const { page, inner, outer } = smallPage(engine());
		const f = engine().functions;
		const scroller = f.__CreateScrollView(0);
		f.__AppendElement(outer, scroller);
		engine().flattenViews();
		f.__FlushElementTree(page);
		expect(invoke(scroller)).toEqual([{ code: 0 }]);
		expect(invoke(inner)).toEqual([{ code: 6 }]);
	});

	it("has a view of its own with a listener", () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__AddEventListener(inner, "tap", () => {}, {});
		engine().functions.__FlushElementTree(page);
		expect(invoke(inner)).toEqual([{ code: 0 }]);
	});

	it("has a view of its own with a main-thread function", () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__AddEvent(inner, "bindEvent", "tap", { type: "worklet", value: {} });
		engine().functions.__FlushElementTree(page);
		expect(invoke(inner)).toEqual([{ code: 0 }]);
	});
});

describe("an element that stopped being flattened", () => {
	it("answers as the flattened element until the tree is flushed, then rightly", () => {
		const { page, inner } = smallPage(engine());
		engine().flattenViews();
		engine().functions.__FlushElementTree(page);
		engine().respondWith(() => ({ code: 0, data: { left: 12, top: 200, width: 30, height: 40 } }));
		const answers = [...invoke(inner)];
		engine().functions.__SetAttribute(inner, "flatten", false);
		answers.push(...invoke(inner));
		engine().functions.__FlushElementTree(page);
		answers.push(...invoke(inner));
		expect(answers).toEqual([
			{ code: 6 },
			{ code: 0, data: { left: 0, top: 0, width: 30, height: 40 } },
			{ code: 0, data: { left: 12, top: 200, width: 30, height: 40 } },
		]);
		expect(engine().invocations.map((call) => call.code)).toEqual([6, 0, 0]);
	});
});
