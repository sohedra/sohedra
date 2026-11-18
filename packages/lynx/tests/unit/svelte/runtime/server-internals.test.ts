// The first frame's server runtime: Svelte's, with each value written as the main thread's parser
// reads it back, a component's `--x` props wrapped in a <view>, and `$props.id()` in a branch only
// one thread renders counted on its own.

import { describe, expect, it } from "@rstest/core";

import { isBlock, parsePage } from "../../../../src/main-thread/frame/html.ts";
import type { DrawnNode } from "../../../../src/main-thread/frame/html.ts";
import {
	attr,
	attributes,
	css_props,
	props_id,
	ThreadBranch,
} from "../../../../src/svelte/runtime/server-internals.ts";

/** The attributes of `<view>` with `written` in its tag, as the parser reads them. */
function readBack(written: string): { attrs: Record<string, unknown>; events: string[] } {
	let next = 1;
	const page = parsePage(`<view${written}></view>`, 1, () => ++next);
	const [view] = page.children;
	if (!view || isBlock(view)) throw new Error("No view was drawn.");
	return {
		attrs: Object.fromEntries((view as DrawnNode).attrs),
		events: (view as DrawnNode).events.map(({ type, name }) => `${type}:${name}`),
	};
}

describe("the first frame's attributes", () => {
	it("write a string as Svelte does", () => {
		expect(attr("title", `a "b" & c`)).toBe(` title="a &quot;b&quot; &amp; c"`);
		expect(readBack(attr("title", `a "b" & c`)).attrs).toEqual({ title: `a "b" & c` });
	});

	it("write numbers, booleans, objects and arrays so that they read back as values", () => {
		const values: Record<string, unknown> = {
			"span-count": 2,
			"sticky-top": false,
			muted: true,
			"data-info": { quote: 'it\'s <1> & "2"' },
			"accessibility-actions": ["a", "b"],
		};
		const written = Object.entries(values)
			.map(([name, value]) => attr(name, value))
			.join("");
		expect(readBack(written).attrs).toEqual(values);
	});

	it("write markup and line separators in a value escaped, so a list's cells read back whole", () => {
		const value = { s: "<list-item></list-item></list>", line: "a\u2028b\u2029c" };
		const written = attr("data-x", value);
		expect(written).not.toMatch(/[<>\u2028\u2029]/);
		let next = 1;
		const page = parsePage(
			`<list><list-item item-key="a"${written}><text>a</text></list-item><list-item item-key="b"></list-item></list>`,
			1,
			() => ++next,
		);
		const list = page.children[0] as DrawnNode;
		expect(list.cells!.map((cell) => cell.attrs.get("item-key"))).toEqual(["a", "b"]);
		expect(list.cells![0]!.attrs.get("data-x")).toEqual(value);
	});

	it("write a function as its name alone: an event's binds, any other's is dropped", () => {
		const written = attr("bindtap", () => {}) + attr("ontap", () => {}) + attr("compute", () => {});
		expect(written).toBe(" bindtap ontap compute");
		expect(readBack(written)).toEqual({
			attrs: {},
			events: ["bindEvent:tap", "bindEvent:tap"],
		});
	});

	it("leave out what Svelte leaves out", () => {
		expect(attr("hidden", null)).toBe("");
		expect(attr("hidden", undefined)).toBe("");
	});

	it("write a spread's values the same way, Svelte's own as Svelte does, with the names' case", () => {
		const written = attributes({
			class: "a",
			maxLength: 4,
			customName: "x",
			ontap: () => {},
			"data-o": { a: 1 },
		});
		expect(readBack(written)).toEqual({
			attrs: { class: "a", maxLength: 4, customName: "x", "data-o": { a: 1 } },
			events: ["bindEvent:tap"],
		});
	});
});

describe("a component given --x props", () => {
	it("is wrapped in a <view> with the props in its style", () => {
		let html = "";
		const renderer = { push: (part: string) => (html += part) };
		css_props(renderer, true, { "--tone": "green" }, () => renderer.push("<text>child</text>"));
		expect(html).toMatch(
			/^<view style="[^"]*--tone: green;?"><text>child<\/text><!---->.*<\/view>$/,
		);
	});

	it("in SVG's namespace too", () => {
		let html = "";
		const renderer = { push: (part: string) => (html += part) };
		css_props(renderer, false, { "--tone": "red" }, () => {}, true);
		expect(html).toMatch(/^<view style="[^"]*--tone: red;?"><\/view>$/);
	});
});

describe("$props.id() in the first frame", () => {
	/** A component's renderer in one render, whose own count Svelte keeps on `global`. */
	function rendering() {
		let uid = 1;
		const pushed: string[] = [];
		const global = { uid: () => `lynx-s${uid++}` };
		return { global, pushed, push: (html: string) => void pushed.push(html) };
	}

	it("is Svelte's outside a branch only one thread renders", () => {
		const renderer = rendering();
		expect([props_id(renderer), props_id(renderer)]).toEqual(["lynx-s1", "lynx-s2"]);
		expect(renderer.pushed).toEqual(["<!--$lynx-s1-->", "<!--$lynx-s2-->"]);
	});

	it("counts its own in such a branch, from the first in each render, and leaves Svelte's alone", () => {
		const renderer = rendering();
		const ids: string[] = [];
		ThreadBranch(renderer, {
			thread: "main-thread",
			render: (target) => ids.push(props_id(target), props_id(target)),
		});
		ids.push(props_id(renderer));
		expect(ids).toEqual(["lynx-m1", "lynx-m2", "lynx-s1"]);
		const next = rendering();
		ThreadBranch(next, { thread: "main-thread", render: (target) => ids.push(props_id(target)) });
		expect(ids.at(-1)).toBe("lynx-m1");
	});
});
