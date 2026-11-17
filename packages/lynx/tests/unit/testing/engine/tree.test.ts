// The engine's tree: elements made, joined and taken apart, each a real DOM node.

import { describe, expect, it } from "@rstest/core";

import { engineForEach, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();

/** The names of the elements under `parent`, as the DOM has them. */
const childTags = (parent: Node) =>
	[...parent.childNodes].map((node) => (node as Element).localName ?? node.nodeName);

describe("creating elements", () => {
	it("makes each kind as a DOM element of its tag, and the page in the container", () => {
		const f = engine().functions;
		const page = f.__CreatePage("0", 0) as Element;
		expect(page.localName).toBe("page");
		expect(page.parentNode).toBe(document.body);
		expect((f.__CreateView(0) as Element).localName).toBe("view");
		expect((f.__CreateText(0) as Element).localName).toBe("text");
		expect((f.__CreateImage(0) as Element).localName).toBe("image");
		expect((f.__CreateScrollView(0) as Element).localName).toBe("scroll-view");
		expect((f.__CreateElement("list-item", 0) as Element).localName).toBe("list-item");
	});

	it("makes a raw-text as a text node, so a query finds its text", () => {
		const f = engine().functions;
		const raw = f.__CreateElement("raw-text", 0);
		expect(raw.nodeType).toBe(Node.TEXT_NODE);
		f.__SetAttribute(raw, "text", "hello");
		expect(raw.textContent).toBe("hello");
		f.__SetAttribute(raw, "text", "bye");
		expect(raw.textContent).toBe("bye");
		f.__SetAttribute(raw, "text", null);
		expect(raw.textContent).toBe("");
	});

	it("numbers the elements from 1, one by one, and finds each by its number", () => {
		const f = engine().functions;
		const first = f.__CreatePage("0", 0);
		const second = f.__CreateView(0);
		expect(f.__GetElementUniqueID(first)).toBe(1);
		expect(f.__GetElementUniqueID(second)).toBe(2);
		expect(engine().byUid(2)).toBe(second);
		expect(engine().byUid(9)).toBeUndefined();
	});

	it("counts the elements made of a tag, attached or not", () => {
		const f = engine().functions;
		f.__CreateView(0);
		f.__CreateView(0);
		f.__CreateText(0);
		expect(engine().madeCount("view")).toBe(2);
		expect(engine().madeCount("text")).toBe(1);
		expect(engine().madeCount("image")).toBe(0);
	});

	it("keeps the page, and answers undefined for it before one is made", () => {
		const f = engine().functions;
		expect(f.__GetPageElement()).toBeUndefined();
		expect(engine().page()).toBeUndefined();
		const page = f.__CreatePage("0", 0);
		expect(f.__GetPageElement()).toBe(page);
		expect(engine().page()).toBe(page);
	});

	it("refuses what Lynx's functions refuse: a parent that is not a number, a tag that is not text", () => {
		const f = engine().functions;
		expect(() => f.__CreateView("0" as never)).toThrow("__CreateView param 0 should be a number");
		expect(() => f.__CreateElement("" as never, 0)).toThrow(
			"__CreateElement param 0 should be a tag name",
		);
		expect(() => f.__CreatePage(0 as never, 0)).toThrow("__CreatePage param 0 should be a string");
	});
});

describe("joining and taking apart", () => {
	it("appends at the end, inserts before a child, and removes", () => {
		const f = engine().functions;
		const page = f.__CreatePage("0", 0);
		const a = f.__CreateView(0);
		const b = f.__CreateText(0);
		const c = f.__CreateImage(0);
		f.__AppendElement(page, a);
		f.__AppendElement(page, b);
		f.__InsertElementBefore(page, c, a);
		expect(childTags(page)).toEqual(["image", "view", "text"]);
		f.__RemoveElement(page, a);
		expect(childTags(page)).toEqual(["image", "text"]);
		expect(a.parentNode).toBeNull();
	});

	it("appends when the reference is none: the engine takes null and undefined there", () => {
		const f = engine().functions;
		const page = f.__CreatePage("0", 0);
		const a = f.__CreateView(0);
		const b = f.__CreateText(0);
		f.__AppendElement(page, a);
		f.__InsertElementBefore(page, b, null);
		expect(childTags(page)).toEqual(["view", "text"]);
		const c = f.__CreateImage(0);
		f.__InsertElementBefore(page, c, undefined);
		expect(childTags(page)).toEqual(["view", "text", "image"]);
	});

	it("moves a subtree with its element, and lists the elements depth first", () => {
		const { page, outer, inner } = smallPage(engine());
		expect(engine().all()).toEqual([page, outer, inner]);
		const f = engine().functions;
		f.__RemoveElement(page, outer);
		expect(engine().all()).toEqual([page]);
		expect(engine().all(outer)).toEqual([outer, inner]);
	});

	it("throws where the engine only logs an error and carries on: inserting what is attached", () => {
		const f = engine().functions;
		const { page, outer, inner } = smallPage(engine());
		const other = f.__CreateView(0);
		f.__AppendElement(page, other);
		expect(() => f.__AppendElement(other, inner)).toThrow(
			"__AppendElement was given a <view> that is still in a <view>",
		);
		expect(() => f.__InsertElementBefore(page, outer, other)).toThrow(
			"__InsertElementBefore was given a <view> that is still in a <page>",
		);
		expect(inner.parentNode).toBe(outer);
	});

	it("throws where the engine only logs an error and carries on: a reference or child that is not in the parent", () => {
		const f = engine().functions;
		const { page, inner } = smallPage(engine());
		const stray = f.__CreateView(0);
		const fresh = f.__CreateView(0);
		expect(() => f.__InsertElementBefore(page, fresh, stray)).toThrow(
			"__InsertElementBefore was given a reference that is not in the parent",
		);
		expect(() => f.__RemoveElement(page, inner)).toThrow(
			"__RemoveElement was given a child that is not in the parent",
		);
		expect(fresh.parentNode).toBeNull();
	});

	it("refuses a value that is not one of its elements", () => {
		const f = engine().functions;
		const page = f.__CreatePage("0", 0);
		const foreign = document.createElement("div");
		expect(() => f.__AppendElement(page, foreign)).toThrow(
			"__AppendElement param 1 should be an element",
		);
		expect(() => f.__AppendElement({} as never, page)).toThrow(
			"__AppendElement param 0 should be an element",
		);
	});
});

describe("forgetting", () => {
	it("lets go of an element and what is under it", () => {
		const { page, outer, inner } = smallPage(engine());
		engine().functions.__RemoveElement(page, outer);
		const outerUid = engine().functions.__GetElementUniqueID(outer);
		const innerUid = engine().functions.__GetElementUniqueID(inner);
		engine().forget(outerUid);
		expect(engine().byUid(outerUid)).toBeUndefined();
		expect(engine().byUid(innerUid)).toBeUndefined();
		expect(engine().byUid(engine().functions.__GetElementUniqueID(page))).toBe(page);
	});
});

describe("taking the engine down", () => {
	it("takes the page out of the document, and its elements with it", () => {
		const { page } = smallPage(engine());
		expect(document.body.contains(page)).toBe(true);
		engine().dispose();
		expect(document.body.contains(page)).toBe(false);
		expect(engine().page()).toBeUndefined();
	});
});
