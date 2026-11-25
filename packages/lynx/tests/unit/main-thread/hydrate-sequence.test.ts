// Hydration's match by block and position: a parent's children, and a block's content, as a
// sequence of elements and blocks that must line up; blocks at any depth; marks that cannot be
// read; and which adopted elements hydration is not sure of, where an early event is not replayed.

import { describe, expect, it } from "@rstest/core";

import type { Plan } from "../../../src/main-thread/hydrate/match.ts";
import { matchPlan, planOf, refusalOf } from "./match-plan.ts";
import type { Built } from "./match-plan.ts";

/** The background's ids of the elements hydration is not sure of, in order. */
const unsure = (plan: Plan): number[] => [...plan.unsure].sort((a, b) => a - b);

const element =
	(tag: string) =>
	(id: number, children: Built[] = [], tone?: string): Built => ({
		id,
		tag,
		children,
		...(tone !== undefined && { attrs: { class: tone } }),
	});
const view = element("view");
const text = element("text");
const block = (branch: number, children: Built[]): Built => ({ branch, children });

describe("the elements hydration is not sure of", () => {
	it("are none outside every block", () => {
		expect(unsure(matchPlan(`<view><text>a</text></view>`, [view(10, [text(11, ["b"])])]))).toEqual(
			[],
		);
	});

	it("are those it wrote an attribute over in a block, and not what is under them", () => {
		expect(
			unsure(
				matchPlan(`<view><!--[0--><view class="a"><text>x</text></view><!--]--></view>`, [
					view(10, [block(0, [view(11, [text(12, ["x"])], "b")])]),
				]),
			),
		).toEqual([11]);
	});

	it("are none where it wrote only the ids of $props.id() in a block", () => {
		expect(
			unsure(
				matchPlan(`<view><!--[0--><view id="lynx-s1"></view><!--]--></view>`, [
					view(10, [block(0, [{ id: 11, tag: "view", attrs: { id: "lynx-b1" } }])]),
				]),
			),
		).toEqual([]);
	});

	it("are none where it wrote only a text in a block", () => {
		expect(
			unsure(
				matchPlan(`<view><!--[0--><text>a</text><!--]--></view>`, [
					view(10, [block(0, [text(11, ["b"])])]),
				]),
			),
		).toEqual([]);
	});
});

describe("hydration's match of blocks in blocks", () => {
	it("pairs blocks both took alike at any depth", () => {
		expect(
			planOf(
				`<view><!--[0--><view><!--[1--><text>a</text><!--]--></view><!--[-1--><!--]--><!--]--></view>`,
				[view(10, [block(0, [view(11, [block(1, [text(12, ["a"])])]), block(-1, [])])])],
			),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <view> = 3",
			"adopt 12 <text> = 4",
			'adopt 1000 "a" = 5',
		]);
	});

	it("makes an inner block that took another branch again, and pairs the outer one's other entries", () => {
		expect(
			planOf(`<view><!--[0--><image></image><!--[0--><text>a</text><!--]--><!--]--></view>`, [
				view(10, [block(0, [{ id: 11, tag: "image" }, block(-1, [view(12)])])]),
			]),
		).toEqual([
			"adopt 10 <view> = 2",
			"adopt 11 <image> = 3",
			"make again in 10 = 2: make 12, drop 4",
		]);
	});

	it("makes the outer block's content again where an inner block is on one side only", () => {
		expect(
			planOf(`<view><!--[0--><!--[0--><text>a</text><!--]--><!--]--></view>`, [
				view(10, [block(0, [text(11, ["a"])])]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11, drop 3"]);
	});
});

describe("hydration's match where marks cannot be read", () => {
	it("makes the parent's children again, and does not refuse, outside every block", () => {
		expect(
			planOf(`<view><text>a</text><!--[0--><image></image><!--]--></view>`, [
				view(10, [
					text(11, ["a"]),
					{ branch: 0, children: [{ id: 12, tag: "image" }], unreadable: true },
				]),
			]),
		).toEqual(["adopt 10 <view> = 2", "make again in 10 = 2: make 11 12, drop 3 5"]);
	});

	it("refuses a parent with no mark for a drawn block, outside every block", () => {
		expect(
			refusalOf(`<view><!--[0--><text>a</text><!--]--></view>`, [view(10, [text(11, ["a"])])]),
		).toEqual({ kind: "tag", element: 10 });
	});
});
