// The engine's lifecycle events, as `lynx.getEngine()` and `lynx.getNative()` hand them to the main
// thread: message events with a type, the data and where they come from.

import { afterEach, describe, expect, it } from "@rstest/core";

import { installGlobals } from "../../../../src/testing/globals.ts";
import { createEngine } from "../../../../src/testing/index.ts";
import { engineForEach } from "./engine-fixture.ts";

const engine = engineForEach();

describe("the engine's lifecycle", () => {
	it("tells each listener of an event type, with the event's data as the engine sends it", () => {
		const { lifecycle } = engine();
		const heard: unknown[] = [];
		lifecycle.engine.addEventListener("__RenderPage", (event) => heard.push(event));
		lifecycle.render({ count: 1 });
		lifecycle.update({ count: 2 }, { reset: true });
		expect(heard).toEqual([{ type: "__RenderPage", data: [{ count: 1 }, {}], origin: "Engine" }]);
	});

	it("names the types the engine sends: render, update, global props and components", () => {
		const { lifecycle } = engine();
		const heard: [string, unknown][] = [];
		for (const type of [
			"__RenderPage",
			"__UpdatePage",
			"__UpdateGlobalProps",
			"__RemoveComponents",
			"__DestroyLifetime",
		]) {
			lifecycle.engine.addEventListener(type, (event) => heard.push([type, event.data]));
		}
		lifecycle.render({ a: 1 }, { first: true });
		lifecycle.update({ a: 2 }, { reset: true });
		lifecycle.updateGlobalProps({ theme: "dark" });
		lifecycle.removeComponents();
		lifecycle.destroy(7);
		expect(heard).toEqual([
			["__RenderPage", [{ a: 1 }, { first: true }]],
			["__UpdatePage", [{ a: 2 }, { reset: true }]],
			["__UpdateGlobalProps", [{ theme: "dark" }]],
			["__RemoveComponents", []],
		]);
	});

	it("ends the page's life through lynx.getNative(), with the page's instance id as the data", () => {
		const { lifecycle } = engine();
		const heard: unknown[] = [];
		lifecycle.native.addEventListener("__DestroyLifetime", (event) => heard.push(event));
		lifecycle.destroy(7);
		expect(heard).toEqual([{ type: "__DestroyLifetime", data: 7, origin: "Native" }]);
	});

	it("counts the listeners of a type, and lets one go, also while it is being told", () => {
		const { lifecycle } = engine();
		const heard: string[] = [];
		const once = () => {
			heard.push("once");
			lifecycle.engine.removeEventListener("__RenderPage", once);
		};
		lifecycle.engine.addEventListener("__RenderPage", once);
		lifecycle.engine.addEventListener("__RenderPage", () => heard.push("always"));
		expect(lifecycle.count("__RenderPage")).toBe(2);
		lifecycle.render();
		lifecycle.render();
		expect(heard).toEqual(["once", "always", "always"]);
		expect(lifecycle.count("__RenderPage")).toBe(1);
	});

	it("sends any other type with emit", () => {
		const { lifecycle } = engine();
		const heard: unknown[] = [];
		lifecycle.engine.addEventListener("__OnLowMemory", (event) => heard.push(event.data));
		lifecycle.emit("__OnLowMemory", [1]);
		expect(heard).toEqual([[1]]);
	});
});

describe("an engine event that no one listens to", () => {
	let restore: (() => void) | undefined;
	afterEach(() => {
		restore?.();
		restore = undefined;
	});

	it("calls the main thread's global function of that name instead, with the same arguments", () => {
		const { lifecycle } = engine();
		const calls: unknown[][] = [];
		restore = installGlobals({
			renderPage: (...args: unknown[]) => calls.push(["renderPage", ...args]),
			updatePage: (...args: unknown[]) => calls.push(["updatePage", ...args]),
			removeComponents: (...args: unknown[]) => calls.push(["removeComponents", ...args]),
		});
		lifecycle.render({ a: 1 });
		lifecycle.update({ a: 2 }, { reset: true });
		lifecycle.removeComponents();
		expect(calls).toEqual([
			["renderPage", { a: 1 }, {}],
			["updatePage", { a: 2 }, { reset: true }],
			["removeComponents"],
		]);
	});

	it("is reported when the main thread has no such global either: Lynx calls it, not tries it", () => {
		const { lifecycle } = engine();
		expect(() => lifecycle.updateGlobalProps({ theme: "dark" })).toThrow(
			"The engine sent __UpdateGlobalProps, and the main thread has no updateGlobalProps function",
		);
	});

	it("is reported through the engine's report option when it has one", () => {
		const reported: unknown[] = [];
		const own = createEngine({ report: (error) => reported.push(error) });
		own.lifecycle.render();
		expect(reported).toEqual([
			expect.objectContaining({ message: expect.stringContaining("renderPage") }),
		]);
		own.dispose();
	});

	it("is not sent as a call when someone listens", () => {
		const { lifecycle } = engine();
		const calls: string[] = [];
		restore = installGlobals({ renderPage: () => calls.push("call") });
		lifecycle.engine.addEventListener("__RenderPage", () => calls.push("event"));
		lifecycle.render();
		expect(calls).toEqual(["event"]);
	});
});
