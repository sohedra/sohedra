// Frames: the main thread's requestAnimationFrame, and what the platform has measured. Android
// measures a view's content at the frame after a flush, so until then a UI method sees the content
// as the frame before measured it.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement, ShownElement } from "../../../../src/testing/index.ts";
import { engineForEach, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();

/** A later macrotask: the engine's frames come on one. */
const nextTask = () => new Promise<void>((resolve) => setImmediate(resolve));

/** How many children the platform had measured in `element` when a UI method ran on it. */
function measuredChildren(element: LynxElement): number | undefined {
	let seen: ShownElement | undefined;
	engine().respondWith((_method, _params, _element, _shown, measured) => {
		seen = measured;
		return { code: 0 };
	});
	engine().functions.__InvokeUIMethod(element, "scrollTo", {}, () => {});
	return seen?.children.length;
}

describe("requestAnimationFrame", () => {
	it("runs the callback once, at a frame on a later task, with the time", async () => {
		const times: unknown[] = [];
		engine().functions.requestAnimationFrame((time) => times.push(typeof time));
		expect(times).toEqual([]);
		await nextTask();
		expect(times).toEqual(["number"]);
	});

	it("runs a callback asked for during a frame at the next frame", async () => {
		const ran: string[] = [];
		const f = engine().functions;
		f.requestAnimationFrame(() => {
			ran.push("first");
			f.requestAnimationFrame(() => ran.push("second"));
		});
		await nextTask();
		expect(ran).toEqual(["first"]);
		await nextTask();
		expect(ran).toEqual(["first", "second"]);
	});

	it("drops a callback that is canceled", async () => {
		const ran: string[] = [];
		const f = engine().functions;
		const id = f.requestAnimationFrame(() => ran.push("canceled"));
		f.requestAnimationFrame(() => ran.push("kept"));
		f.cancelAnimationFrame(id);
		await nextTask();
		expect(ran).toEqual(["kept"]);
	});
});

describe("what the platform has measured", () => {
	it("is nothing before the frame after the first flush", async () => {
		const { page, outer } = smallPage(engine());
		engine().functions.__FlushElementTree(page);
		expect(measuredChildren(outer)).toBeUndefined();
		await nextTask();
		expect(measuredChildren(outer)).toBe(1);
	});

	it("follows a flush only at the frame after it, as Android measures", async () => {
		const { page, outer } = smallPage(engine());
		const f = engine().functions;
		f.__FlushElementTree(page);
		await nextTask();
		f.__AppendElement(outer, f.__CreateView(0));
		f.__FlushElementTree(page);
		expect(measuredChildren(outer)).toBe(1);
		await nextTask();
		expect(measuredChildren(outer)).toBe(2);
	});

	it("is measured after the frame's callbacks run, so they see the frame before", async () => {
		const { page, outer } = smallPage(engine());
		const f = engine().functions;
		f.__FlushElementTree(page);
		await nextTask();
		f.__AppendElement(outer, f.__CreateView(0));
		f.__FlushElementTree(page);
		const seen: (number | undefined)[] = [];
		f.requestAnimationFrame(() => {
			seen.push(measuredChildren(outer));
			f.requestAnimationFrame(() => seen.push(measuredChildren(outer)));
		});
		await nextTask();
		await nextTask();
		expect(seen).toEqual([1, 2]);
	});

	it("gives the responder the element as the flush showed it, and as the platform measured it", async () => {
		const { page, outer } = smallPage(engine());
		const f = engine().functions;
		f.__FlushElementTree(page);
		await nextTask();
		f.__AppendElement(outer, f.__CreateView(0));
		f.__FlushElementTree(page);
		const seen: unknown[] = [];
		engine().respondWith((_method, _params, _element, shown, measured) => {
			seen.push([shown?.children.length, measured?.children.length]);
			return { code: 0 };
		});
		f.__InvokeUIMethod(outer, "scrollTo", {}, () => {});
		expect(seen).toEqual([[2, 1]]);
	});
});
