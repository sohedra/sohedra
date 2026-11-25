// Hydration's match as a value: which drawn node each of the background's nodes is adopted from,
// what is written over, what is made again, what refuses, and which pairs hydration is not sure
// of. Svelte's blocks pair by the branch each took on both threads: the background's side of each
// test says it, as its branch marks do. A difference inside a block is made again; only one
// outside every block refuses.

import { describe, expect, it } from "@rstest/core";

import { BranchKey } from "../../../src/wire/index.ts";
import type { AttrValue } from "../../../src/wire/index.ts";
import { planOf, refusalOf } from "./match-plan.ts";
import type { Built, BuiltRow } from "./match-plan.ts";

const el = (
	id: number,
	tag: string,
	children: Built[] = [],
	attrs?: Record<string, AttrValue>,
): Built => ({ id, tag, children, ...(attrs && { attrs }) });

/** An `{#if}` the background rendered, with the branch it took: 0, 1… or -1 for none. */
const block = (branch: number, children: Built[]): Built => ({ branch, children });

const list = (id: number, rows: BuiltRow[]): Built => ({ id, tag: "list", rows });

/** The markup of a list of the page whose rows are `<text>`s of their keys. */
const drawnList = (keys: string[]): string =>
	`<list>${keys.map((key) => `<list-item item-key="${key}"><text>${key}</text></list-item>`).join("")}</list>`;

describe("hydration's match, outside every block", () => {
	it("adopts each element and text in its place, with nothing written", () => {
		expect(
			planOf(`<view class="card"><text>Hi</text><image src="a.png"></image></view>`, [
				el(10, "view", [el(11, "text", ["Hi"]), el(12, "image", [], { src: "a.png" })], {
					class: "card",
				}),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "Hi" = 4',
			"adopt 12 <image> = 5",
		]);
	});

	it("takes an empty class for none and a style by its declarations, and skips main-thread attributes", () => {
		expect(
			planOf(`<view class="" style="color: red; "><text>x</text></view>`, [
				el(10, "view", [el(11, "text", ["x"])], {
					style: "color:red",
					"main-thread:bindtap": { id: 1 },
				}),
			]),
		).toEqual(["adopt 10 <view> = 2", "adopt 11 <text> = 3", 'adopt 1000 "x" = 4']);
	});

	it("writes a text that differs", () => {
		expect(planOf(`<text>Hello</text>`, [el(10, "text", ["Bye"])])).toEqual([
			"adopt 10 <text> = 2",
			'adopt 1000 "Bye" = 3',
			'write 1000 text "Bye"',
		]);
	});

	it("pairs texts by the element they follow", () => {
		expect(
			planOf(`<text>a<text>b</text>c</text>`, [el(10, "text", ["a", el(11, "text", ["b"]), "c"])]),
		).toEqual([
			"adopt 10 <text> = 2",
			'adopt 1000 "a" = 3',
			"adopt 11 <text> = 4",
			'adopt 1001 "b" = 5',
			'adopt 1002 "c" = 6',
		]);
	});

	// Svelte's server writes nothing for an empty text, and its client makes one.
	it("makes the empty texts the first frame has none of", () => {
		expect(planOf(`<text></text>`, [el(10, "text", [""])])).toEqual([
			"adopt 10 <text> = 2",
			"texts again in 10 = 2: make 1000, drop none",
		]);
	});

	it("makes a parent's texts again where the two sides have as many elements and other texts", () => {
		expect(planOf(`<text>ab</text>`, [el(10, "text", ["a", "b"])])).toEqual([
			"adopt 10 <text> = 2",
			"texts again in 10 = 2: make 1000 1001, drop 3",
		]);
	});

	it("writes an attribute that differs only in the ids of $props.id(), and reports it", () => {
		expect(
			planOf(`<view id="lynx-s1"><text>x</text></view>`, [
				el(10, "view", [el(11, "text", ["x"])], { id: "lynx-b1" }),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "x" = 4',
			'write 10 id "lynx-b1"',
			'props id 10 id "lynx-b1" over "lynx-s1"',
		]);
	});

	// An `{#each}`'s plain markers are read through. Nothing either thread reports says which row
	// is which, so rows in another order, as many as the first frame drew, pair by place, are sure,
	// and only their texts are written. Pairing by branch leaves this as it is.
	it("pairs rows in another order by place, writing their texts", () => {
		expect(
			planOf(`<view><!--[--><text>a</text><text>b</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["b"]), el(12, "text", ["a"])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "b" = 4',
			"adopt 12 <text> = 5",
			'adopt 1001 "a" = 6',
			'write 1000 text "b"',
			'write 1001 text "a"',
		]);
	});

	it.each([
		[
			"a tag that differs",
			`<view></view>`,
			[el(10, "text")],
			{ kind: "tag", element: 10, expected: "text", got: "view" },
		],
		[
			"an element only the background has",
			`<view></view>`,
			[el(10, "view"), el(11, "text")],
			{ kind: "missing", element: 11, expected: "text" },
		],
		[
			"an element only the first frame has",
			`<view></view><text></text>`,
			[el(10, "view")],
			{ kind: "extra", element: 1, got: "text" },
		],
		[
			"an element only the background has, deeper",
			`<view><text></text></view>`,
			[el(10, "view", [el(11, "text"), el(12, "image")])],
			{ kind: "missing", element: 12, expected: "image" },
		],
		[
			"an attribute that differs",
			`<view class="a"></view>`,
			[el(10, "view", [], { class: "b" })],
			{ kind: "attribute", element: 10, name: "class", expected: "b", got: "a" },
		],
		[
			"an attribute only the first frame has",
			`<view hidden="x"></view>`,
			[el(10, "view")],
			{ kind: "attribute", element: 10, name: "hidden", expected: undefined, got: "x" },
		],
		[
			"an attribute that differs in more than the ids of $props.id()",
			`<view id="lynx-s1 a"></view>`,
			[el(10, "view", [], { id: "lynx-b1 b" })],
			{ kind: "attribute", element: 10, name: "id", expected: "lynx-b1 b", got: "lynx-s1 a" },
		],
	] as const)("refuses %s", (_, markup, built, mismatch) => {
		expect(refusalOf(markup, [...built])).toEqual(mismatch);
	});
});

describe("hydration's match of a list", () => {
	const rows: BuiltRow[] = ["a", "b", "c"].map((key, index) => ({
		id: 20 + index * 2,
		key,
		children: [el(21 + index * 2, "text", [key])],
	}));

	it("adopts the cells Lynx holds by key, and lets go of the rest", () => {
		expect(
			planOf(drawnList(["a", "b", "c"]), [list(10, rows)], { cells: ["a"], handedBack: ["b"] }),
		).toEqual([
			"adopt 10 <list> = 2",
			"adopt 20 <list-item> = 3",
			"adopt 21 <text> = 6",
			'adopt 1000 "a" = 7',
			"list 10 = 2: items 20 22 24, cells 3 - -",
			"adopted cells 20",
		]);
	});

	it("refuses keys that differ", () => {
		expect(
			refusalOf(drawnList(["a", "x", "b"]), [list(10, rows.slice(0, 2))], { cells: ["a"] }),
		).toEqual({ kind: "list-keys", element: 10, expected: ["a", "b"], got: ["a", "x", "b"] });
	});

	it("refuses a held cell the background sent no row for", () => {
		expect(
			refusalOf(drawnList(["a"]), [list(10, [{ ...rows[0]!, sent: false }])], { cells: ["a"] }),
		).toEqual({ kind: "extra", element: 10, got: "list-item" });
	});

	it("refuses an attribute that differs in a row it holds", () => {
		expect(
			refusalOf(
				`<list><list-item item-key="a"><text class="x">a</text></list-item></list>`,
				[list(10, [{ id: 20, key: "a", children: [el(21, "text", ["a"], { class: "y" })] }])],
				{ cells: ["a"] },
			),
		).toEqual({ kind: "attribute", element: 21, name: "class", expected: "y", got: "x" });
	});

	it("refuses a row it holds whose tags differ", () => {
		expect(
			refusalOf(
				`<list><list-item item-key="a"><text>a</text></list-item></list>`,
				[list(10, [{ id: 20, key: "a", children: [el(21, "image")] }])],
				{ cells: ["a"] },
			),
		).toEqual({ kind: "tag", element: 21, expected: "image", got: "text" });
	});

	it("adopts a list inside a cell with its rows as children", () => {
		expect(
			planOf(
				`<list><list-item item-key="a"><list><list-item item-key="x"><text>x</text></list-item></list></list-item></list>`,
				[
					list(10, [
						{
							id: 20,
							key: "a",
							children: [
								el(30, "list", [el(31, "list-item", [el(32, "text", ["x"])], { "item-key": "x" })]),
							],
						},
					]),
				],
				{ cells: ["a"] },
			),
		).toEqual([
			"adopt 10 <list> = 2",
			"adopt 20 <list-item> = 3",
			"adopt 30 <list> = 4",
			"adopt 31 <list-item> = 5",
			"adopt 32 <text> = 6",
			'adopt 1000 "x" = 7',
			"list 10 = 2: items 20, cells 3",
			"adopted cells 20",
			"list in a cell 30 = 4",
		]);
	});

	it("makes a block in a row again, in the cell", () => {
		expect(
			planOf(
				`<list><list-item item-key="a"><!--[-1--><text>x</text><!--]--></list-item></list>`,
				[list(10, [{ id: 20, key: "a", children: [block(0, [el(21, "image")])] }])],
				{ cells: ["a"] },
			),
		).toEqual([
			"adopt 10 <list> = 2",
			"adopt 20 <list-item> = 3",
			"make again in 20 = 3: make 21, drop 4",
			"list 10 = 2: items 20, cells 3",
			"adopted cells 20",
		]);
	});

	// Keys that differ refuse outside every block; inside one, the block's content is made again.
	it("makes a list in a block again when its keys differ, and does not refuse", () => {
		expect(
			planOf(`<view><!--[0--><list><list-item item-key="a"></list-item></list><!--]--></view>`, [
				el(10, "view", [block(0, [list(11, [{ id: 20, key: "b" }])])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11, drop 3"]);
	});

	// Outside every block a held row that differs refuses; inside one, it is made again in its cell.
	describe("inside a block, makes a held row again in its cell", () => {
		const markup = `<view><!--[0--><list><list-item item-key="a"><text>a</text></list-item></list><!--]--></view>`;

		it("whose tags differ", () => {
			expect(
				planOf(
					markup,
					[
						el(10, "view", [
							block(0, [list(11, [{ id: 20, key: "a", children: [el(21, "image")] }])]),
						]),
					],
					{ cells: ["a"] },
				),
			).toEqual([
				"adopt 10 <view> = 2",
				"adopt 11 <list> = 3",
				"adopt 20 <list-item> = 4",
				"make again in 20 = 4: make 21, drop 5",
				"list 11 = 3: items 20, cells 4",
				"adopted cells 20",
			]);
		});

		it("whose elements are not as many", () => {
			expect(
				planOf(
					markup,
					[
						el(10, "view", [
							block(0, [
								list(11, [
									{ id: 20, key: "a", children: [el(21, "text", ["a"]), el(22, "image")] },
								]),
							]),
						]),
					],
					{ cells: ["a"] },
				),
			).toEqual([
				"adopt 10 <view> = 2",
				"adopt 11 <list> = 3",
				"adopt 20 <list-item> = 4",
				"make again in 20 = 4: make 21 22, drop 5",
				"list 11 = 3: items 20, cells 4",
				"adopted cells 20",
			]);
		});
	});
});

describe("hydration's match of Svelte's blocks", () => {
	it("adopts a block both threads drew alike, and is sure of it", () => {
		expect(
			planOf(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
				el(10, "view", [block(0, [el(11, "text", ["x"], { class: "a" })])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "adopt 11 <text> = 3", 'adopt 1000 "x" = 4']);
	});

	it("writes the ids of $props.id() in a block without reporting them, and stays sure", () => {
		expect(
			planOf(`<view><!--[0--><text id="lynx-s1">x</text><!--]--></view>`, [
				el(10, "view", [block(0, [el(11, "text", ["x"], { id: "lynx-b1" })])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "x" = 4',
			'write 11 id "lynx-b1"',
		]);
	});

	it("makes a block that took another branch again in place, and keeps what is outside it", () => {
		expect(
			planOf(`<view><text>Title</text><!--[0--><view class="a"></view><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Title"]), block(1, [el(12, "text", ["Now"])])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "Title" = 4',
			"make again in 10 = 2: make 12, drop 5",
		]);
	});

	it("leaves a run settled where it made only an empty text among its parent's", () => {
		expect(
			planOf(`<text><!--[0--><text>a</text><!--]--></text>`, [
				el(10, "text", ["", block(0, [el(11, "text", ["a"])])]),
			]),
		).toEqual([
			"adopt 10 <text> = 2",
			"adopt 11 <text> = 3",
			'adopt 1001 "a" = 4',
			"texts again in 10 = 2: make 1000, drop none",
		]);
	});

	// The background marks the place of an `{#await}` given a promise, and draws its branch after
	// the page rendered: the first frame's pending branch is taken off, and what is around adopted.
	it("makes an {#await} given a promise again, and adopts what is around it", () => {
		expect(
			planOf(`<view><text>Title</text><!--[await--><text>Loading</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Title"]), block(BranchKey.Await, [])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "Title" = 4',
			"make again in 10 = 2: make none, drop 5",
		]);
	});

	// A block that is not an `{#if}`'s branch explains a difference: the parent's children are made
	// again, with no refusal, when the background has no mark for it.
	it("makes a parent's children again where an {#await} given a promise has no mark", () => {
		expect(
			planOf(`<view><text>Title</text><!--[await--><text>Loading</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Title"])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11, drop 3 5"]);
	});

	it("refuses a parent's children that do not line up around a block both took alike", () => {
		expect(
			refusalOf(`<view><!--[0--><text>a</text><!--]--><image></image></view>`, [
				el(10, "view", [block(0, [el(11, "text", ["a"])]), el(12, "view")]),
			]),
		).toEqual({ kind: "tag", element: 12, expected: "view", got: "image" });
	});
});

// Pairs inside blocks, by the branch each took on both threads. Each test once pinned what the
// match guessed from tags; its name and comment say what pairing by branch makes of it.
describe("hydration's match of blocks, by branch", () => {
	it("writes an attribute that differs in a block both took alike, and is not sure of that element", () => {
		expect(
			planOf(`<view><!--[0--><text class="a" hidden="x">x</text><!--]--></view>`, [
				el(10, "view", [block(0, [el(11, "text", ["x"], { class: "b" })])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "x" = 4',
			'write 11 class "b"',
			"write 11 hidden null",
			"unsure 11",
		]);
	});

	// A text written over never counts.
	it("writes a text in a block both took alike, and is sure of it", () => {
		expect(
			planOf(
				`<view><view><!--[0--><text>a</text><!--]--></view><view><!--[0--><text>b</text><!--]--></view></view>`,
				[
					el(10, "view", [
						el(11, "view", [block(0, [el(12, "text", ["a"])])]),
						el(13, "view", [block(0, [el(14, "text", ["c"])])]),
					]),
				],
			),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <view> = 3",
			"adopt 12 <text> = 4",
			'adopt 1000 "a" = 5',
			"adopt 13 <view> = 6",
			"adopt 14 <text> = 7",
			'adopt 1001 "c" = 8',
			'write 1001 text "c"',
		]);
	});

	it("pairs an element with its own beside a block only the background renders, and makes that block", () => {
		expect(
			planOf(`<view><!--[0--><text>Open</text><!--]--><!--[-1--><!--]--></view>`, [
				el(10, "view", [
					block(0, [el(11, "text", ["Open"])]),
					block(0, [el(12, "text", ["Later"])]),
				]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "Open" = 4',
			"make again in 10 = 2: make 12, drop none",
		]);
	});

	it("makes a block that took another branch with the same tags again", () => {
		expect(
			planOf(`<view><!--[-1--><text>Log in</text><!--]--></view>`, [
				el(10, "view", [block(0, [el(11, "text", ["Profile"])])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11, drop 3"]);
	});

	it("makes a block that took another branch that looks the same again", () => {
		expect(
			planOf(`<view><!--[-1--><text>Open</text><!--]--></view>`, [
				el(10, "view", [block(0, [el(11, "text", ["Open"])])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11, drop 3"]);
	});

	// The `{:else}` is a second state the background did not render: drawn as one element against
	// three rows, the parent's children do not line up, and are made again, with no refusal.
	it("makes a parent's children again where an {#each}'s {:else} was drawn against rows", () => {
		expect(
			planOf(`<view><!--[!--><text>Add</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["a"]), el(12, "text", ["b"]), el(13, "text", ["c"])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11 12 13, drop 3"]);
	});

	it("pairs a second state both drew with its own", () => {
		expect(
			planOf(`<view><text>a</text><!--[!--><text>Add</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["a"]), block(BranchKey.Second, [el(12, "text", ["Add"])])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "a" = 4',
			"adopt 12 <text> = 5",
			'adopt 1001 "Add" = 6',
		]);
	});

	it("leaves out a second state with nothing in it, on either side", () => {
		expect(
			planOf(`<view><!--[!--><!--]--><text>a</text></view>`, [
				el(10, "view", [el(11, "text", ["a"])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "adopt 11 <text> = 3", 'adopt 1000 "a" = 4']);
		expect(
			planOf(`<view><text>a</text></view>`, [
				el(10, "view", [el(11, "text", ["a"]), block(BranchKey.Second, [])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "adopt 11 <text> = 3", 'adopt 1000 "a" = 4']);
	});

	it("makes a block's content again whole where it does not line up, in a block both took alike", () => {
		expect(
			planOf(`<view><!--[0--><text>a</text><view></view><text>c</text><!--]--></view>`, [
				el(10, "view", [block(0, [el(11, "text", ["a"]), el(12, "image"), el(13, "text", ["c"])])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11 12 13, drop 3 5 6"]);
	});

	it("pairs each block on its own, and the elements between them as fixed", () => {
		expect(
			planOf(`<view><!--[0--><text>a</text><!--]--><image></image><!--[-1--><!--]--></view>`, [
				el(10, "view", [
					block(0, [el(11, "text", ["a"])]),
					el(12, "image"),
					block(0, [el(13, "text", ["b"])]),
				]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "a" = 4',
			"adopt 12 <image> = 5",
			"make again in 10 = 2: make 13, drop none",
		]);
	});

	it("pairs an {#if} beside an {#await} given a promise with its own, and drops the pending branch", () => {
		expect(
			planOf(
				`<view><!--[0--><text>a</text><!--]--><!--[await--><text>Loading</text><!--]--></view>`,
				[el(10, "view", [block(0, [el(11, "text", ["a"])]), block(BranchKey.Await, [])])],
			),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "a" = 4',
			"make again in 10 = 2: make none, drop 5",
		]);
	});

	// The blocks say which element is which, whatever main-thread bindings each side has.
	it("pairs elements with main-thread attributes by their blocks", () => {
		const markup = `<view><!--[0--><view class="go"></view><!--]--><!--[-1--><!--]--></view>`;
		expect(
			planOf(markup, [
				el(10, "view", [
					block(0, [el(11, "view", [], { class: "go", "main-thread:bindtap": { id: 1 } })]),
					block(0, [el(12, "view", [], { class: "go" })]),
				]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <view> = 3",
			"make again in 10 = 2: make 12, drop none",
		]);
		expect(
			planOf(markup, [
				el(10, "view", [
					block(0, [el(11, "view", [], { class: "go" })]),
					block(0, [el(12, "view", [], { class: "go", "main-thread:bindtap": { id: 1 } })]),
				]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <view> = 3",
			"make again in 10 = 2: make 12, drop none",
		]);
	});
});
