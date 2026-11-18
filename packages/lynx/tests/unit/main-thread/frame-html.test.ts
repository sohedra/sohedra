// The first frame's parser: the markup the first frame's server runtime writes, as drawn nodes.

import { describe, expect, it } from "@rstest/core";

import {
	elementsOf,
	isBlock,
	parseCell,
	parsePage,
	UnreadableMarkup,
} from "../../../src/main-thread/frame/html.ts";
import type { DrawnChild, DrawnNode } from "../../../src/main-thread/frame/html.ts";

function parse(html: string): DrawnNode {
	let next = 1;
	return parsePage(html, 1, () => ++next);
}

/** The drawn tree as plain data: tags, attributes, events, texts and blocks. */
function shape(child: DrawnChild): unknown {
	if (isBlock(child)) return { block: child.children.map(shape) };
	if (child.tag === "#text") return child.text;
	const node: Record<string, unknown> = { tag: child.tag };
	if (child.attrs.size > 0) node["attrs"] = Object.fromEntries(child.attrs);
	if (child.events.length > 0) node["events"] = child.events;
	if (child.children.length > 0) node["children"] = child.children.map(shape);
	if (child.cells) node["cells"] = child.cells.map((cell) => Object.fromEntries(cell.attrs));
	return node;
}

const page = (html: string): unknown[] => parse(html).children.map(shape);

describe("the first frame's parser", () => {
	it("reads strings in double quotes and typed values as JSON in single quotes", () => {
		expect(
			page(
				`<view class="a &amp; b" span-count='2' sticky='false' data-o='{"k":"it&#39;s"}' title="&lt;&quot;&gt;"></view>`,
			),
		).toEqual([
			{
				tag: "view",
				attrs: {
					class: "a & b",
					"span-count": 2,
					sticky: false,
					"data-o": { k: "it's" },
					title: '<">',
				},
			},
		]);
	});

	it("binds a bare name as an event when it is one, in either spelling, and drops any other", () => {
		expect(
			page(
				`<view bindtap catchlongpress capture-bindscroll ontouchstart onfoo2capture main-thread:bindtap handler></view>`,
			),
		).toEqual([
			{
				tag: "view",
				events: [
					{ type: "bindEvent", name: "tap" },
					{ type: "catchEvent", name: "longpress" },
					{ type: "capture-bind", name: "scroll" },
					{ type: "bindEvent", name: "touchstart" },
					{ type: "capture-bind", name: "foo2" },
				],
			},
		]);
	});

	it("keeps text only inside a text element, and skips comments", () => {
		expect(page(`<view>loose<text>Hi <!---->there</text></view>`)).toEqual([
			{ tag: "view", children: [{ tag: "text", children: ["Hi ", "there"] }] },
		]);
	});

	it("gives an input and a textarea their value as default-value, and ends <input> at its tag", () => {
		expect(page(`<input value="a"><text>after</text><textarea>b &amp; c</textarea>`)).toEqual([
			{ tag: "input", attrs: { "default-value": "a" } },
			{ tag: "text", children: ["after"] },
			{ tag: "textarea", attrs: { "default-value": "b & c" } },
		]);
	});

	it("keeps an {#if}'s branches as blocks, and reads through a fragment's, an {#each}'s", () => {
		expect(
			page(`<!--[--><view></view><!--[-1--><!--]--><!--[0--><text></text><!--]--><!--]-->`),
		).toEqual([{ tag: "view" }, { block: [] }, { block: [{ tag: "text" }] }]);
	});

	it("keeps a list's cells unparsed, a quoted > in a cell's tag included", () => {
		const root = parse(
			`<list><!--[--><list-item item-key="a" title="x > y"><text>a</text></list-item><list-item item-key='2'/><!--]--></list><view></view>`,
		);
		expect(root.children.map(shape)).toEqual([
			{ tag: "list", cells: [{ "item-key": "a", title: "x > y" }, { "item-key": 2 }] },
			{ tag: "view" },
		]);
		const list = root.children[0] as DrawnNode;
		let next = 100;
		const cell = parseCell(list.cells![0]!, () => ++next);
		expect(shape(cell)).toEqual({
			tag: "list-item",
			attrs: { "item-key": "a", title: "x > y" },
			children: [{ tag: "text", children: ["a"] }],
		});
	});

	it("gives a list inside a cell its items as children", () => {
		const root = parse(
			`<list><list-item item-key="a"><list><list-item item-key="b"></list-item></list></list-item></list>`,
		);
		const cell = parseCell((root.children[0] as DrawnNode).cells![0]!, () => 50);
		expect(elementsOf(cell.children).map(shape)).toEqual([
			{ tag: "list", children: [{ tag: "list-item", attrs: { "item-key": "b" } }] },
		]);
	});

	it("reads the cells of a list whatever is between them, and the page after the list", () => {
		const root = parse(
			`<list><!--[--><list-item item-key="a"/>\n<list-item\titem-key="b"  title='{"t":"x > y"}'\n>b</list-item><!--]--> <list-item item-key="c" bindtap/></list><text>after</text>`,
		);
		const list = root.children[0] as DrawnNode;
		expect(list.cells!.map((cell) => [Object.fromEntries(cell.attrs), cell.html])).toEqual([
			[{ "item-key": "a" }, ""],
			[{ "item-key": "b", title: { t: "x > y" } }, "b"],
			[{ "item-key": "c" }, ""],
		]);
		expect(root.children.map(shape)).toEqual([
			expect.objectContaining({ tag: "list" }),
			{ tag: "text", children: ["after"] },
		]);
	});

	it("keeps a cell's markup whole when it holds a list, and reads the cells after it", () => {
		const inner = `<list><list-item item-key="x"><text>x</text></list-item><list-item item-key="y"/></list>`;
		const root = parse(
			`<list><list-item item-key="a">${inner}<text>a</text></list-item><list-item item-key="b"><text>b</text></list-item></list>`,
		);
		const cells = (root.children[0] as DrawnNode).cells!;
		expect(cells.map((cell) => cell.attrs.get("item-key"))).toEqual(["a", "b"]);
		expect(cells[0]!.html).toBe(`${inner}<text>a</text>`);
		expect(cells[1]!.html).toBe("<text>b</text>");
	});

	it("reads a value holding what ends a cell's markup as text", () => {
		const root = parse(
			`<list><list-item item-key="a" title="a = b c" data-x='"&lt;/list-item&gt;"'><text>&lt;/list-item&gt;</text></list-item></list>`,
		);
		const [cell] = (root.children[0] as DrawnNode).cells!;
		expect(Object.fromEntries(cell!.attrs)).toEqual({
			"item-key": "a",
			title: "a = b c",
			"data-x": "</list-item>",
		});
		expect(cell!.html).toBe("<text>&lt;/list-item&gt;</text>");
	});

	it("says where in the page a cell's tag cannot be read", () => {
		let thrown: unknown;
		try {
			parse(`<list><list-item item-key=a></list-item></list>`);
		} catch (error) {
			thrown = error;
		}
		expect((thrown as UnreadableMarkup).message).toBe(
			"the value of item-key on <list-item> is not quoted",
		);
		expect((thrown as UnreadableMarkup).at).toBe(25);
	});

	it.each([
		["a tag with no name", "<view><1></view>", 6, "a tag has no name"],
		["an attribute with no name", `<view ="a"></view>`, 6, "an attribute of <view> has no name"],
		[
			"a value not quoted",
			"<view class=a></view>",
			11,
			"the value of class on <view> is not quoted",
		],
		[
			"a value not closed",
			`<view class="a></view>`,
			11,
			"the value of class on <view> is not closed",
		],
		["a tag not closed", `<view class="a"`, 0, "the tag <view> is not closed"],
		["a comment not closed", "<view><!-- </view>", 6, "a comment is not closed"],
		["a closing tag not closed", "<view></view", 6, "a closing tag is not closed"],
		["a closing tag with no element", "</view>", 0, "a closing tag has no element"],
		["an element not closed", "<view><text>", 12, "the element <text> is not closed"],
		["a list not closed", "<list><list-item></list-item>", 6, "a <list> is not closed"],
	])("throws for %s, and says where", (_, html, at, reason) => {
		let thrown: unknown;
		try {
			parse(html);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(UnreadableMarkup);
		expect((thrown as UnreadableMarkup).message).toBe(reason);
		expect((thrown as UnreadableMarkup).at).toBe(at);
	});
});
