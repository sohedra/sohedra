// Hydration's match as a value: which drawn node each of the background's nodes is adopted from,
// what is written over, what is made again, what refuses, and which pairs hydration is not sure
// of. Inside Svelte's blocks the match pairs by tags, a guess; the tests that say "for now" pin
// what that guess does, and say what pairing by the branch each `{#if}` took makes of them.

import { describe, expect, it } from "@rstest/core";

import type { AttrValue } from "../../../src/wire/index.ts";
import { planOf, refusalOf } from "./match-plan.ts";
import type { Built, BuiltRow } from "./match-plan.ts";

const el = (
	id: number,
	tag: string,
	children: Built[] = [],
	attrs?: Record<string, AttrValue>,
): Built => ({ id, tag, children, ...(attrs && { attrs }) });

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
			'adopt 1002 "c" = 6',
			"adopt 11 <text> = 4",
			'adopt 1001 "b" = 5',
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

	it("refuses an attribute that differs in a row it holds", () => {
		expect(
			refusalOf(
				`<list><list-item item-key="a"><text class="x">a</text></list-item></list>`,
				[list(10, [{ id: 20, key: "a", children: [el(21, "text", ["a"], { class: "y" })] }])],
				{ cells: ["a"] },
			),
		).toEqual({ kind: "attribute", element: 21, name: "class", expected: "y", got: "x" });
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
				[list(10, [{ id: 20, key: "a", children: [el(21, "image")] }])],
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

	it("makes a list in a block again when its keys differ, and does not refuse", () => {
		expect(
			planOf(`<view><!--[0--><list><list-item item-key="a"></list-item></list><!--]--></view>`, [
				el(10, "view", [list(11, [{ id: 20, key: "b" }])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11, drop 3"]);
	});

	it("refuses, inside a block, a held row whose tags differ, naming only where", () => {
		expect(
			refusalOf(
				`<view><!--[0--><list><list-item item-key="a"><text>a</text></list-item></list><!--]--></view>`,
				[el(10, "view", [list(11, [{ id: 20, key: "a", children: [el(21, "image")] }])])],
				{ cells: ["a"] },
			),
		).toEqual({ kind: "tag", element: 21 });
	});
});

describe("hydration's match of Svelte's blocks", () => {
	it("adopts a block both threads drew alike, and is sure of it", () => {
		expect(
			planOf(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["x"], { class: "a" })]),
			]),
		).toEqual(["adopt 10 <view> = 2", "adopt 11 <text> = 3", 'adopt 1000 "x" = 4']);
	});

	it("writes an attribute that differs in a block, and is not sure of what the block holds", () => {
		expect(
			planOf(`<view><!--[0--><text class="a" hidden="x">x</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["x"], { class: "b" })]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "x" = 4',
			'write 11 class "b"',
			"write 11 hidden null",
			"unsure 11 1000",
		]);
	});

	it("writes the ids of $props.id() in a block without reporting them, and stays sure", () => {
		expect(
			planOf(`<view><!--[0--><text id="lynx-s1">x</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["x"], { id: "lynx-b1" })]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "x" = 4',
			'write 11 id "lynx-b1"',
		]);
	});

	it("makes a block whose tags differ again in place, and keeps what is outside it", () => {
		expect(
			planOf(`<view><text>Title</text><!--[0--><view class="a"></view><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Title"]), el(12, "text", ["Now"])]),
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
				el(10, "text", ["", el(11, "text", ["a"])]),
			]),
		).toEqual([
			"adopt 10 <text> = 2",
			"adopt 11 <text> = 3",
			'adopt 1001 "a" = 4',
			"texts again in 10 = 2: make 1000, drop none",
		]);
	});

	it("judges runs under different parents apart", () => {
		expect(
			planOf(
				`<view><view><!--[0--><text>a</text><!--]--></view><view><!--[0--><text>b</text><!--]--></view></view>`,
				[
					el(10, "view", [
						el(11, "view", [el(12, "text", ["a"])]),
						el(13, "view", [el(14, "text", ["c"])]),
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
			"unsure 14 1001",
		]);
	});

	it("makes an {#await} given a promise again, and adopts what is around it", () => {
		expect(
			planOf(`<view><text>Title</text><!--[await--><text>Loading</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Title"])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "Title" = 4',
			"make again in 10 = 2: make none, drop 5",
		]);
	});
});

// Pairs inside blocks the match guesses from tags. Each pins what the guess does for now; pairing
// by the branch each `{#if}` took changes it as its comment says.
describe("hydration's match of blocks, for now", () => {
	// By branch: the drawn text pairs with 11, whose `{#if}` took the same branch on both threads,
	// and the background-only 12 is made.
	it("pairs an element with one only the background renders beside it, from the end", () => {
		expect(
			planOf(`<view><!--[0--><text>Open</text><!--]--><!--[-1--><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Open"]), el(12, "text", ["Later"])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 12 <text> = 3",
			'adopt 1001 "Later" = 4',
			'write 1001 text "Later"',
			"make again in 10 = 2: make 11, drop none",
			"unsure 12 1001",
		]);
	});

	// By branch: the drawn "Log in" is dropped and 11 is made: the background took another branch.
	it("adopts another branch with the same tags, writing what differs", () => {
		expect(
			planOf(`<view><!--[-1--><text>Log in</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Profile"])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "Profile" = 4',
			'write 1000 text "Profile"',
			"unsure 11 1000",
		]);
	});

	// By branch: as the one above, made again. For now nothing differs, so the run settles and its
	// pairs are sure: an early tap there runs the other branch's handler.
	it("adopts another branch that looks the same, and is sure of it", () => {
		expect(
			planOf(`<view><!--[-1--><text>Open</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["Open"])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "adopt 11 <text> = 3", 'adopt 1000 "Open" = 4']);
	});

	// By branch: the `{:else}` is still a block the background does not report; drawn as one
	// element against three rows, it does not line up, and the parent's children are made again.
	it("pairs an {#each}'s {:else} with the last of the background's rows", () => {
		expect(
			planOf(`<view><!--[!--><text>Add</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["a"]), el(12, "text", ["b"]), el(13, "text", ["c"])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 13 <text> = 3",
			'adopt 1002 "c" = 4',
			'write 1002 text "c"',
			"make again in 10 = 2: make 11 12, drop none",
			"unsure 13 1002",
		]);
	});

	// By branch: the same. Nothing either thread reports says which row is which, so rows in
	// another order, as many as the first frame drew, keep pairing by place, and are sure.
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

	// By branch: a block both took alike whose content does not line up is made again whole.
	it("adopts a block's content from both ends and makes its middle again", () => {
		expect(
			planOf(`<view><!--[0--><text>a</text><view></view><text>c</text><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["a"]), el(12, "image"), el(13, "text", ["c"])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "a" = 4',
			"adopt 13 <text> = 6",
			'adopt 1001 "c" = 7',
			"make again in 10 = 2: make 12, drop 5",
			"unsure 11 13 1000 1001",
		]);
	});

	// By branch: each block stands alone, and the image between them is a fixed element, sure.
	it("takes blocks beside each other, and the elements between them, as one run", () => {
		expect(
			planOf(`<view><!--[0--><text>a</text><!--]--><image></image><!--[-1--><!--]--></view>`, [
				el(10, "view", [el(11, "text", ["a"]), el(12, "image"), el(13, "text", ["b"])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 3",
			'adopt 1000 "a" = 4',
			"adopt 12 <image> = 5",
			"make again in 10 = 2: make 13, drop none",
			"unsure 11 12 1000",
		]);
	});

	// By branch: the `{#if}`'s element pairs with its own drawn element, and only the pending
	// branch is made again.
	it("pairs an {#if} beside an {#await} given a promise with the pending branch", () => {
		expect(
			planOf(
				`<view><!--[0--><text>a</text><!--]--><!--[await--><text>Loading</text><!--]--></view>`,
				[el(10, "view", [el(11, "text", ["a"])])],
			),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <text> = 5",
			'adopt 1000 "a" = 6',
			'write 1000 text "a"',
			"make again in 10 = 2: make none, drop 3",
			"unsure 11 1000",
		]);
	});

	// By branch: the check goes: the block, not a main-thread binding, says which element is which.
	describe("where the first frame bound a main-thread attribute", () => {
		const markup = `<view><!--[0--><view class="go"></view><!--]--><!--[-1--><!--]--></view>`;
		const built = [
			el(10, "view", [
				el(11, "view", [], { class: "go", "main-thread:bindtap": { id: 1 } }),
				el(12, "view", [], { class: "go" }),
			]),
		];

		it("pairs it with the background's element that has one too", () => {
			expect(planOf(markup, built, { binds: [3] })).toEqual([
				"adopt 10 <view> = 2",
				"adopt 11 <view> = 3",
				"make again in 10 = 2: make 12, drop none",
				"unsure 11",
			]);
		});

		it("pairs by tags alone where it bound none", () => {
			expect(planOf(markup, built)).toEqual([
				"adopt 10 <view> = 2",
				"adopt 12 <view> = 3",
				"make again in 10 = 2: make 11, drop none",
				"unsure 12",
			]);
		});
	});
});
