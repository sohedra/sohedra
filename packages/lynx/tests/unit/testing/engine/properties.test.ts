// What an element carries: attributes, classes, id, dataset and inline styles, each kept as the
// engine keeps it and shown on the DOM element.

import { describe, expect, it } from "@rstest/core";

import { engineForEach, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();

describe("attributes", () => {
	it("keeps each value as it was given, and shows it on the DOM element as text", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetAttribute(inner, "scroll-y", true);
		f.__SetAttribute(inner, "label", "Save");
		f.__SetAttribute(inner, "options", { a: 1 });
		expect(f.__GetAttributeByName(inner, "scroll-y")).toBe(true);
		expect(f.__GetAttributeByName(inner, "options")).toEqual({ a: 1 });
		const dom = inner as Element;
		expect(dom.getAttribute("scroll-y")).toBe("true");
		expect(dom.getAttribute("label")).toBe("Save");
		expect(dom.getAttribute("options")).toBe('{"a":1}');
		expect(f.__GetAttributeNames(inner)).toEqual(["scroll-y", "label", "options"]);
	});

	it("takes an attribute away with null or undefined, and answers undefined for one that is not there", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetAttribute(inner, "label", "Save");
		f.__SetAttribute(inner, "label", null);
		expect(f.__GetAttributeByName(inner, "label")).toBeUndefined();
		expect((inner as Element).hasAttribute("label")).toBe(false);
		f.__SetAttribute(inner, "other", "x");
		f.__SetAttribute(inner, "other", undefined);
		expect(f.__GetAttributeNames(inner)).toEqual([]);
	});

	it("refuses an empty name, as the engine does", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		expect(() => f.__SetAttribute(inner, "", "x")).toThrow(
			"__SetAttribute param 1 should be a name that is not empty",
		);
		expect(() => f.__GetAttributeByName(inner, "")).toThrow(
			"__GetAttributeByName param 1 should be a name that is not empty",
		);
	});

	it("keeps a name the DOM would refuse, and does not show it", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetAttribute(inner, "a b", 1);
		expect(f.__GetAttributeByName(inner, "a b")).toBe(1);
	});

	it("keeps a text's own text on the DOM node", () => {
		const f = engine().functions;
		const raw = f.__CreateElement("raw-text", 0);
		f.__SetAttribute(raw, "text", "hi");
		expect(f.__GetAttributeByName(raw, "text")).toBe("hi");
	});
});

describe("classes and id", () => {
	it("sets the classes as one string, and shows them as the class attribute", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetClasses(inner, "row active");
		expect((inner as Element).className).toBe("row active");
		f.__SetClasses(inner, "");
		expect((inner as Element).hasAttribute("class")).toBe(false);
		expect(engine().state(inner).classes).toBe("");
	});

	it("sets the id, and takes it away with null", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		expect((inner as Element).id).toBe("inner");
		f.__SetID(inner, null);
		expect((inner as Element).hasAttribute("id")).toBe(false);
		expect(engine().state(inner).id).toBeNull();
	});
});

describe("dataset", () => {
	it("replaces the dataset, as the engine does, and keeps each value as it was given", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetDataset(inner, { row: 3, kind: "a" });
		f.__SetDataset(inner, { row: 4 });
		expect(engine().state(inner).dataset).toEqual({ row: 4 });
		expect((inner as Element).getAttribute("data-row")).toBe("4");
		expect((inner as Element).hasAttribute("data-kind")).toBe(false);
	});

	it("takes a hyphenated key, and shows it as the data attribute of that name", () => {
		const { inner } = smallPage(engine());
		engine().functions.__SetDataset(inner, { "drag-handle": true, nested: { a: [1] } });
		expect(engine().state(inner).dataset).toEqual({ "drag-handle": true, nested: { a: [1] } });
		expect((inner as Element).getAttribute("data-drag-handle")).toBe("true");
		expect((inner as Element).getAttribute("data-nested")).toBe('{"a":[1]}');
	});
});

describe("inline styles", () => {
	it("adds one style at a time, and takes one away with null", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddInlineStyle(inner, "opacity", "0.5");
		f.__AddInlineStyle(inner, "width", 20);
		expect((inner as Element).getAttribute("style")).toBe("opacity: 0.5; width: 20");
		f.__AddInlineStyle(inner, "opacity", null);
		expect((inner as Element).getAttribute("style")).toBe("width: 20");
	});

	it("sets all at once from text, wiping the ones added one by one", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddInlineStyle(inner, "opacity", "0.5");
		f.__SetInlineStyles(inner, "color: red; background: url(data:image/png;base64,AAA) no-repeat");
		expect(f.__GetComputedStyleByKey(inner, "opacity")).toBe("");
		expect(f.__GetComputedStyleByKey(inner, "color")).toBe("red");
		expect(f.__GetComputedStyleByKey(inner, "background")).toBe(
			"url(data:image/png;base64,AAA) no-repeat",
		);
	});

	it("sets all at once from an object, with its names in the engine's dashed form", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetInlineStyles(inner, { flexDirection: "column", "--gap": "4px", opacity: 1 });
		expect(f.__GetComputedStyleByKey(inner, "flex-direction")).toBe("column");
		expect(f.__GetComputedStyleByKey(inner, "--gap")).toBe("4px");
		expect(f.__GetComputedStyleByKey(inner, "opacity")).toBe("1");
	});

	it("clears all with undefined, and refuses what is not text or an object", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddInlineStyle(inner, "opacity", "0.5");
		f.__SetInlineStyles(inner, undefined);
		expect((inner as Element).hasAttribute("style")).toBe(false);
		expect(() => f.__SetInlineStyles(inner, 5 as never)).toThrow(
			"__SetInlineStyles param 1 should be text or an object",
		);
	});

	it("answers a computed style from the inline styles only, and says so by not knowing the rest", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetClasses(inner, "styled");
		expect(f.__GetComputedStyleByKey(inner, "color")).toBe("");
	});

	it("keeps values the DOM's own style parser would drop", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetInlineStyles(inner, "display: linear; linear-orientation: horizontal");
		expect(f.__GetComputedStyleByKey(inner, "display")).toBe("linear");
		expect((inner as Element).getAttribute("style")).toBe(
			"display: linear; linear-orientation: horizontal",
		);
	});
});

describe("queries", () => {
	it("finds the first element or all of them under an element, by class, id, tag or a selector", () => {
		const { page, outer, inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetClasses(inner, "row last");
		expect(f.__QuerySelector(page, "#inner", {})).toBe(inner);
		expect(f.__QuerySelector(page, ".row", {})).toBe(inner);
		expect(f.__QuerySelectorAll(page, "view", {})).toEqual([outer, inner]);
		expect(f.__QuerySelectorAll(page, "#outer > .last", {})).toEqual([inner]);
	});

	it("looks under the element, not at it", () => {
		const { outer, inner } = smallPage(engine());
		const f = engine().functions;
		expect(f.__QuerySelector(outer, "#outer", {})).toBeUndefined();
		expect(f.__QuerySelectorAll(inner, "view", {})).toEqual([]);
	});

	it("answers undefined for no match, as it does for an attribute that is not there", () => {
		const { page } = smallPage(engine());
		expect(engine().functions.__QuerySelector(page, ".nothing", {})).toBeUndefined();
	});

	it("takes an options object, as the engine requires", () => {
		const { page } = smallPage(engine());
		expect(() => engine().functions.__QuerySelector(page, "view", undefined as never)).toThrow(
			"__QuerySelector param 2 should be an object",
		);
	});
});
