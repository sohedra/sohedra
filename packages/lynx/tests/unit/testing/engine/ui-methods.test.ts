// UI methods and the flush: no UI before the tree is flushed, and a plain view answers whether
// Lynx flattens it or not.

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
