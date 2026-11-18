// Attributes in the renderer: what the main thread gets, and what Svelte reads back.

import { describe, expect, it } from "@rstest/core";

import { OpCode } from "../../../src/wire/index.ts";
import { rendererFixture } from "./renderer-fixture.ts";

function setup() {
	const fixture = rendererFixture();
	const element = fixture.element("view");
	fixture.ops();
	return { ...fixture, element };
}

describe("an attribute set to null", () => {
	it("is deleted: Svelte reads it as absent, and the main thread removes it", () => {
		const { renderer, element, ops } = setup();
		renderer.setAttribute(element, "title", "a");
		renderer.setAttribute(element, "title", null);
		expect(renderer.hasAttribute(element, "title")).toBe(false);
		expect(renderer.getAttribute(element, "title")).toBeNull();
		expect(element.getAttributeNames()).toEqual([]);
		expect(ops()).toEqual([
			[OpCode.SetAttr, element.lynxId, "title", "a"],
			[OpCode.SetAttr, element.lynxId, "title", null],
		]);
	});

	it("sends nothing when it was never set, and removeAttribute does the same", () => {
		const { renderer, element, ops } = setup();
		renderer.setAttribute(element, "title", undefined);
		renderer.removeAttribute(element, "id");
		expect(ops()).toEqual([]);
		renderer.setAttribute(element, "id", "x");
		renderer.removeAttribute(element, "id");
		expect(renderer.hasAttribute(element, "id")).toBe(false);
		expect(ops().at(-1)).toEqual([OpCode.SetAttr, element.lynxId, "id", null]);
	});
});

describe("a function as an attribute's value", () => {
	it("reads back as null, not as the function's source text", () => {
		const { renderer, element } = setup();
		const onPick = () => "the source";
		renderer.setAttribute(element, "onpick", onPick);
		expect(renderer.getAttribute(element, "onpick")).toBeNull();
		expect(element.getAttribute("onpick")).toBeNull();
		expect(element.getAttributeNames()).toEqual([]);
	});

	it("is never sent, on a live element or when one is made with it", () => {
		const { renderer, root, element, ops } = setup();
		renderer.setAttribute(element, "onpick", () => {});
		const later = renderer.createElement("view");
		renderer.setAttribute(later, "onpick", () => {});
		renderer.insert(root, later, null);
		expect(ops().filter((op) => op[0] === OpCode.SetAttr)).toEqual([]);
	});
});

describe("a value as the main thread gets it", () => {
	it("keeps strings, numbers, booleans, objects and arrays, and writes a style object as text", () => {
		const { renderer, element, ops } = setup();
		renderer.setAttribute(element, "a", "x");
		renderer.setAttribute(element, "b", 2);
		renderer.setAttribute(element, "c", false);
		renderer.setAttribute(element, "d", { k: 1 });
		renderer.setAttribute(element, "e", ["x"]);
		renderer.setAttribute(element, "style", { backgroundColor: "red", margin: "", width: 2 });
		renderer.setAttribute(element, "f", 3n);
		expect(ops().map((op) => op[3])).toEqual([
			"x",
			2,
			false,
			{ k: 1 },
			["x"],
			"background-color:red;width:2;",
			"3",
		]);
	});

	it("reads back as text through Svelte's getAttribute, and as set through the node's", () => {
		const { renderer, element } = setup();
		renderer.setAttribute(element, "b", 2);
		expect(renderer.getAttribute(element, "b")).toBe("2");
		expect(element.getAttribute("b")).toBe(2);
		expect(element.getAttribute("none")).toBeNull();
	});
});

describe("text", () => {
	it("becomes a raw-text element inside a text element, and setText changes it", () => {
		const { renderer, element, ops } = setup();
		const text = renderer.createElement("text");
		const words = renderer.createTextNode("hi");
		renderer.insert(text, words, null);
		renderer.insert(element, text, null);
		renderer.setText(words, "ho");
		const made = ops();
		expect(made).toContainEqual([OpCode.CreateText, expect.any(Number), "hi"]);
		expect(made.at(-1)).toEqual([OpCode.SetText, expect.any(Number), "ho"]);
	});

	it("of an element replaces its children, as textContent does", () => {
		const { renderer, ops } = setup();
		const text = renderer.createElement("text");
		renderer.setText(text, "one");
		renderer.setText(text, "two");
		expect(renderer.getFirstChild(text)).toBe(renderer.getLastChild(text));
		expect(renderer.getNodeValue(renderer.getFirstChild(text) as never)).toBe("two");
		renderer.setText(text, "");
		expect(renderer.getFirstChild(text)).toBeNull();
		expect(ops()).toEqual([]);
	});
});

describe("an item-key", () => {
	it("goes to the main thread as text, a number written out", () => {
		const { renderer, element, ops } = setup();
		renderer.setAttribute(element, "item-key", 3);
		renderer.setAttribute(element, "item-key", "a");
		expect(ops().map((op) => op[3])).toEqual(["3", "a"]);
	});
});

describe("the value of an input that has no element yet", () => {
	it("is written as its default-value each time, and the main thread is not asked", () => {
		const { renderer, root, ops } = rendererFixture();
		const calls: unknown[] = [];
		renderer.setHost({
			call: (...args) => (calls.push(args), Promise.resolve(null)),
			run: () => {},
		});
		const input = renderer.createElement("input");
		renderer.setAttribute(input, "value", "a");
		renderer.setAttribute(input, "value", "b");
		expect(calls).toEqual([]);
		renderer.insert(root, input, null);
		expect(ops()).toContainEqual([OpCode.SetAttr, expect.any(Number), "default-value", "b"]);
		renderer.setAttribute(input, "value", "c");
		expect(calls).toEqual([[expect.any(Number), ["invoke", "setValue", { value: "c" }]]]);
	});
});
