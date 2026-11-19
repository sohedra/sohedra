// The page's root: one element node for the renderer's life, bound to Lynx's page element while a
// page runs. It takes listeners like the other elements, stops being the page element when the page
// is destroyed, and is the page element again, with the listeners it was given meanwhile, when the
// next page starts.

import { describe, expect, it } from "@rstest/core";

import { OpCode, ROOT_ID } from "../../../src/wire/index.ts";
import { rendererFixture } from "./renderer-fixture.ts";

const handler = () => {};

describe("the root", () => {
	it("is an element node tagged page, with the page element's id", () => {
		const { renderer, root } = rendererFixture();
		expect(renderer.root).toBe(root);
		expect(root.tag).toBe("page");
		expect(root.lynxId).toBe(ROOT_ID);
		expect(renderer.nodeById(ROOT_ID)).toBe(root);
		expect(root.id).toBe("");
		expect(root.dataset).toEqual({});
		expect(root.isConnected).toBe(true);
		expect(root.parentElement).toBeNull();
	});

	it("binds and unbinds events on the page element, with and without capture", () => {
		const { root, ops } = rendererFixture();
		root.addEventListener("tap", handler, { capture: true });
		root.removeEventListener("tap", handler, { capture: true });
		expect(ops()).toEqual([
			[OpCode.SetEvent, ROOT_ID, "capture-bind", "tap", 1],
			[OpCode.SetEvent, ROOT_ID, "capture-bind", "tap", 0],
		]);
	});

	it("holds what is inserted under it, and inserts it into the page element", () => {
		const { root, element, ops } = rendererFixture();
		const view = element("view");
		expect(root.contains(view)).toBe(true);
		expect(ops()).toEqual([
			[OpCode.Create, view.lynxId, "view"],
			[OpCode.Insert, ROOT_ID, view.lynxId, 0],
		]);
	});

	it("stops being the page element when the page is retired, and sends nothing after", () => {
		const { renderer, root, ops, handlers } = rendererFixture();
		root.addEventListener("tap", handler);
		ops();
		renderer.retire();
		expect(root.lynxId).toBe(0);
		expect(renderer.nodeById(ROOT_ID)).toBeUndefined();
		expect(handlers.size).toBe(0);
		root.addEventListener("tap", handler);
		root.removeEventListener("tap", handler);
		expect(ops()).toEqual([]);
		expect(root.isConnected).toBe(false);
	});

	it("is the same node when the next page starts, bound with the listeners it got meanwhile", () => {
		const { renderer, root, element, ops } = rendererFixture();
		element("view");
		renderer.retire();
		root.addEventListener("tap", handler, { capture: true });
		ops();
		expect(renderer.attachRoot()).toBe(root);
		expect(root.lynxId).toBe(ROOT_ID);
		expect(renderer.nodeById(ROOT_ID)).toBe(root);
		expect(root.first).toBeNull();
		expect(ops()).toEqual([[OpCode.SetEvent, ROOT_ID, "capture-bind", "tap", 1]]);
	});
});
