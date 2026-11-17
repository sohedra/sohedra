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

	it("takes an attribute away with null or undefined, and answers null for one that is not there", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetAttribute(inner, "label", "Save");
		f.__SetAttribute(inner, "label", null);
		expect(f.__GetAttributeByName(inner, "label")).toBeNull();
		expect(f.__GetAttributeByName(inner, "never")).toBeNull();
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

	it("refuses classes that are not text, as the engine does", () => {
		const { inner } = smallPage(engine());
		expect(() => engine().functions.__SetClasses(inner, ["a"] as never)).toThrow(
			"__SetClasses param 1 should be text",
		);
	});

	it("refuses an id that is not text or none, where Lynx would set an empty one", () => {
		const { inner } = smallPage(engine());
		expect(() => engine().functions.__SetID(inner, 7 as never)).toThrow(
			"__SetID param 1 should be text or none",
		);
	});

	it("sets the id, and empties it with null, as Lynx keeps it", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		expect((inner as Element).id).toBe("inner");
		f.__SetID(inner, null);
		expect((inner as Element).hasAttribute("id")).toBe(false);
		expect(engine().state(inner).id).toBe("");
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

	it("round-trips a hyphenated key: an event's target and Lynx's selectors see it as given", () => {
		const { page, inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetDataset(inner, { "drag-handle": "yes" });
		const targets: unknown[] = [];
		f.__AddEventListener(
			inner,
			"tap",
			(event) => targets.push((event as { target: unknown }).target),
			{},
		);
		engine().dispatch(inner, { type: "tap" });
		expect(targets).toEqual([{ id: "inner", uid: 3, dataset: { "drag-handle": "yes" } }]);
		expect(f.__QuerySelector(page, "[data-drag-handle=yes]", {})).toBe(inner);
		expect((inner as HTMLElement).dataset["dragHandle"]).toBe("yes");
	});

	it("refuses a dataset that is not an object", () => {
		const { inner } = smallPage(engine());
		expect(() => engine().functions.__SetDataset(inner, "row" as never)).toThrow(
			"__SetDataset param 1 should be an object",
		);
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

	it("are computed at the flush: until then the computed style is the last flush's", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddInlineStyle(inner, "opacity", "0.5");
		expect(f.__GetComputedStyleByKey(inner, "opacity")).toBe("");
		f.__FlushElementTree();
		f.__AddInlineStyle(inner, "opacity", "0.7");
		expect(f.__GetComputedStyleByKey(inner, "opacity")).toBe("0.5");
	});

	it("drops a custom property added one by one, which has no style id", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddInlineStyle(inner, "--tone", "red");
		f.__FlushElementTree();
		expect(engine().state(inner).inlineStyles.has("--tone")).toBe(false);
		expect(f.__GetComputedStyleByKey(inner, "--tone")).toBe("");
	});

	it("sets all at once from text, wiping the ones added one by one", () => {
		const { inner } = smallPage(engine());
		const f = engine().functions;
		f.__AddInlineStyle(inner, "opacity", "0.5");
		f.__SetInlineStyles(inner, "color: red; background: url(data:image/png;base64,AAA) no-repeat");
		f.__FlushElementTree();
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
		f.__FlushElementTree();
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

	it("refuses a style named as in JavaScript: the engine looks a style up by its CSS name", () => {
		const { inner } = smallPage(engine());
		expect(() => engine().functions.__AddInlineStyle(inner, "backgroundColor", "red")).toThrow(
			"__AddInlineStyle was given backgroundColor",
		);
		expect(() => engine().functions.__AddInlineStyle(inner, 12 as never, "red")).toThrow(
			"__AddInlineStyle param 1 should be a name that is not empty",
		);
	});

	it("reads a computed style by its name, which must be text", () => {
		const { inner } = smallPage(engine());
		expect(() => engine().functions.__GetComputedStyleByKey(inner, 1 as never)).toThrow(
			"__GetComputedStyleByKey param 1 should be text",
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
		f.__FlushElementTree();
		expect(f.__GetComputedStyleByKey(inner, "display")).toBe("linear");
		expect((inner as Element).getAttribute("style")).toBe(
			"display: linear; linear-orientation: horizontal",
		);
	});
});

describe("queries", () => {
	it("finds the first element or all of them, by class, id, tag, and the two combinators", () => {
		const { page, outer, inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetClasses(inner, "row last");
		expect(f.__QuerySelector(page, "#inner", {})).toBe(inner);
		expect(f.__QuerySelector(page, ".row", {})).toBe(inner);
		expect(f.__QuerySelectorAll(page, "view", {})).toEqual([outer, inner]);
		expect(f.__QuerySelectorAll(page, "#outer > .last", {})).toEqual([inner]);
		expect(f.__QuerySelectorAll(page, "page view.row", {})).toEqual([inner]);
		expect(f.__QuerySelectorAll(page, "page > .row", {})).toEqual([]);
		expect(f.__QuerySelectorAll(page, "#inner, #outer", {})).toEqual([outer, inner]);
	});

	it("starts at the element itself, as Lynx's selector does, in the tree's order", () => {
		const { page, outer, inner } = smallPage(engine());
		const f = engine().functions;
		expect(f.__QuerySelector(outer, "#outer", {})).toBe(outer);
		expect(f.__QuerySelectorAll(outer, "view", {})).toEqual([outer, inner]);
		expect(f.__QuerySelectorAll(inner, "#outer view", {})).toEqual([]);
		expect(f.__QuerySelector(page, "page", {})).toBe(page);
		// An empty selector is the element itself, which Lynx keeps "for compatibility".
		expect(f.__QuerySelectorAll(outer, "", {})).toEqual([outer]);
	});

	it("matches a data attribute against the dataset, by its key as given", () => {
		const { page, inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetDataset(inner, { "drag-handle": true, row: 7 });
		f.__SetAttribute(inner, "label", "Save");
		expect(f.__QuerySelector(page, "[data-drag-handle]", {})).toBe(inner);
		expect(f.__QuerySelector(page, "[data-row=7]", {})).toBe(inner);
		expect(f.__QuerySelector(page, "view[label=Save]", {})).toBe(inner);
		expect(f.__QuerySelector(page, "[label^=Sa]", {})).toBe(inner);
		expect(f.__QuerySelector(page, "[label$=ve]", {})).toBe(inner);
		expect(f.__QuerySelector(page, "[label*=av]", {})).toBe(inner);
		expect(f.__QuerySelector(page, "[id=inner]", {})).toBeNull();
	});

	it("throws for a selector Lynx does not take, where Lynx finds nothing", () => {
		const { page } = smallPage(engine());
		const f = engine().functions;
		for (const selector of ["*", ":first-child", "view:first-child", "a + b", "a ~ b", "a >"]) {
			expect(() => f.__QuerySelectorAll(page, selector, {}), selector).toThrow(
				"Lynx's selectors do not take",
			);
		}
		expect(() => f.__QuerySelector(page, "[data-row='7']", {})).toThrow(
			"Lynx compares the quotes as part of the value",
		);
	});

	it("takes a name as Lynx does: a tag starts with a letter, a class or id may start with a digit", () => {
		const { page, inner } = smallPage(engine());
		const f = engine().functions;
		f.__SetClasses(inner, "1col");
		expect(f.__QuerySelector(page, ".1col", {})).toBe(inner);
		expect(() => f.__QuerySelector(page, "_view", {})).toThrow("Lynx's selectors do not take");
	});

	it("answers null for no match, as it does for an attribute that is not there", () => {
		const { page } = smallPage(engine());
		expect(engine().functions.__QuerySelector(page, ".nothing", {})).toBeNull();
	});

	it("takes an options object, as the engine requires", () => {
		const { page } = smallPage(engine());
		expect(() => engine().functions.__QuerySelector(page, "view", undefined as never)).toThrow(
			"__QuerySelector param 2 should be an object",
		);
	});
});
