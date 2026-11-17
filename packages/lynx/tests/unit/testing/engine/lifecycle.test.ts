// The engine's lifecycle events, as `lynx.getEngine()` hands them to the page.

import { describe, expect, it } from "@rstest/core";

import { engineForEach } from "./engine-fixture.ts";

const engine = engineForEach();

describe("the engine's lifecycle", () => {
	it("tells each listener of an event type, with the event's data as the engine sends it", () => {
		const { lifecycle } = engine();
		const heard: unknown[] = [];
		lifecycle.proxy.addEventListener("__RenderPage", (event) => heard.push(event));
		lifecycle.render({ count: 1 });
		lifecycle.update({ count: 2 }, { reset: true });
		expect(heard).toEqual([{ data: [{ count: 1 }, {}] }]);
	});

	it("names the types the engine sends: render, update, global props, components and destroy", () => {
		const { lifecycle } = engine();
		const heard: [string, unknown][] = [];
		for (const type of [
			"__RenderPage",
			"__UpdatePage",
			"__UpdateGlobalProps",
			"__RemoveComponents",
			"__DestroyLifetime",
		]) {
			lifecycle.proxy.addEventListener(type, (event) => heard.push([type, event.data]));
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
			["__DestroyLifetime", [7]],
		]);
	});

	it("counts the listeners of a type, and lets one go, also while it is being told", () => {
		const { lifecycle } = engine();
		const heard: string[] = [];
		const once = () => {
			heard.push("once");
			lifecycle.proxy.removeEventListener("__RenderPage", once);
		};
		lifecycle.proxy.addEventListener("__RenderPage", once);
		lifecycle.proxy.addEventListener("__RenderPage", () => heard.push("always"));
		expect(lifecycle.count("__RenderPage")).toBe(2);
		lifecycle.render();
		lifecycle.render();
		expect(heard).toEqual(["once", "always", "always"]);
		expect(lifecycle.count("__RenderPage")).toBe(1);
	});

	it("sends any other type with emit", () => {
		const { lifecycle } = engine();
		const heard: unknown[] = [];
		lifecycle.proxy.addEventListener("__OnLowMemory", (event) => heard.push(event.data));
		lifecycle.emit("__OnLowMemory", [1]);
		expect(heard).toEqual([[1]]);
	});
});
