// The renderer's tree: fragments and anchors, which exist only on the background, and where their
// elements land on the main thread.

import { describe, expect, it } from "@rstest/core";

import { OpCode, ROOT_ID } from "../../../src/wire/index.ts";
import { rendererFixture } from "./renderer-fixture.ts";

describe("a fragment", () => {
	it("gives its elements to the element it is inserted into, before the anchor's element", () => {
		const { renderer, root, element, ops } = rendererFixture();
		const last = element("view");
		ops();
		const fragment = renderer.createFragment();
		const anchor = renderer.createComment("");
		const inner = renderer.createFragment();
		const a = renderer.createElement("view");
		const b = renderer.createElement("image");
		renderer.insert(inner, b, null);
		renderer.insert(fragment, anchor, null);
		renderer.insert(fragment, a, null);
		renderer.insert(fragment, inner, null);
		const holder = renderer.createElement("view");
		renderer.insert(holder, fragment, null);
		// Not on the page yet: nothing is made.
		expect(ops()).toEqual([]);
		renderer.insert(root, holder, last);
		const made = ops();
		expect(made.filter((op) => op[0] === OpCode.Create).map((op) => op[2])).toEqual([
			"view",
			"view",
			"image",
		]);
		expect(made.at(-1)).toEqual([OpCode.Insert, ROOT_ID, expect.any(Number), last.lynxId]);
	});

	it("is removed with what is in it, and its elements are released", () => {
		const { renderer, root, ops, handlers } = rendererFixture();
		const fragment = renderer.createFragment();
		const view = renderer.createElement("view");
		renderer.addEventListener(view, "tap", () => {});
		renderer.insert(fragment, view, null);
		const anchor = renderer.createComment("");
		renderer.insert(root, anchor, null);
		renderer.insert(root, fragment, anchor);
		ops();
		renderer.remove(view);
		expect(ops().map((op) => op[0])).toEqual([OpCode.Remove, OpCode.Release]);
		expect(handlers.size).toBe(0);
		const empty = renderer.createFragment();
		renderer.remove(empty as never);
		expect(ops()).toEqual([]);
	});
});

describe("the renderer's other answers", () => {
	it("names an element's tag by its id, and nothing for an unknown id", () => {
		const { renderer, element } = rendererFixture();
		const view = element("scroll-view");
		expect(renderer.tagOf(view.lynxId)).toBe("scroll-view");
		expect(renderer.tagOf(9999)).toBeUndefined();
	});

	it("sets an attribute through the node, and ignores the removal of a listener it never had", () => {
		const { renderer, element, ops } = rendererFixture();
		const view = element("view");
		ops();
		view.setAttribute("title", "a");
		renderer.removeEventListener(view, "tap", () => {});
		expect(ops()).toEqual([[OpCode.SetAttr, view.lynxId, "title", "a"]]);
	});

	it("reads an object attribute's text as its JSON, and one that has none as empty", () => {
		const { renderer, element } = rendererFixture();
		const view = element("view");
		const cycle: Record<string, unknown> = {};
		cycle["self"] = cycle;
		renderer.setAttribute(view, "a", { k: 1 });
		renderer.setAttribute(view, "b", cycle);
		renderer.setAttribute(view, "c", true);
		expect(renderer.getAttribute(view, "a")).toBe('{"k":1}');
		expect(renderer.getAttribute(view, "b")).toBe("");
		expect(renderer.getAttribute(view, "c")).toBe("true");
	});

	it("retires once: a second time does nothing", () => {
		const { renderer, root } = rendererFixture();
		renderer.retire();
		renderer.retire();
		expect(root.lynxId).toBe(0);
	});
});
