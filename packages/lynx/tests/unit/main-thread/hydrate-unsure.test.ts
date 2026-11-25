// Which adopted nodes hydration's match is not sure of: those a run of Svelte blocks paired by
// their shape, when the run did not pair one to one or hydration wrote over what it adopted. An
// early event on one of them is not replayed.

import { describe, expect, it } from "@rstest/core";

import type { Plan } from "../../../src/main-thread/hydrate/match.ts";
import { matchPlan } from "./match-plan.ts";
import type { Built } from "./match-plan.ts";

/** The background's ids of the unsure nodes, in order. */
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
/** An `{#if}` the background rendered, with the branch it took. */
const block = (branch: number, children: Built[]): Built => ({ branch, children });
const text = element("text");

describe("the nodes hydration is not sure of", () => {
	it("are none outside every block", () => {
		const plan = matchPlan(`<view class="a"><text>x</text></view>`, [
			view(10, [text(11, ["x"])], "a"),
		]);
		expect(plan.adopt).toHaveLength(3);
		expect(unsure(plan)).toEqual([]);
	});

	it("are none in a run that paired one to one, with nothing written", () => {
		const plan = matchPlan(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
			view(10, [block(0, [text(11, ["x"], "a")])]),
		]);
		expect(unsure(plan)).toEqual([]);
	});

	it("are what a run that made something again adopted, and what is under it", () => {
		const plan = matchPlan(
			`<view><!--[0--><view class="a"><text>x</text></view><!--]--><!--[-1--><!--]--></view>`,
			[view(10, [block(0, [view(11, [text(12, ["x"])], "a")]), block(0, [view(13, [], "a")])])],
		);
		expect(plan.repairs).toHaveLength(1);
		expect(unsure(plan)).toEqual([11, 12, 1000]);
	});

	it("are what a run wrote an attribute over", () => {
		const plan = matchPlan(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
			view(10, [block(0, [text(11, ["x"], "b")])]),
		]);
		expect(unsure(plan)).toEqual([11, 1000]);
	});

	it("are what a run wrote a text over", () => {
		const plan = matchPlan(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
			view(10, [block(0, [text(11, ["y"], "a")])]),
		]);
		expect(unsure(plan)).toEqual([11, 1000]);
	});

	it("are none where a run wrote only the ids of $props.id()", () => {
		const plan = matchPlan(`<view><!--[0--><text class="lynx-s1">x</text><!--]--></view>`, [
			view(10, [block(0, [text(11, ["x"], "lynx-b1")])]),
		]);
		expect(plan.writes).toHaveLength(1);
		expect(unsure(plan)).toEqual([]);
	});

	it("are none where a run made only texts that are empty", () => {
		const plan = matchPlan(`<view><!--[0--><text class="a"></text><!--]--></view>`, [
			view(10, [block(0, [text(11, [""], "a")])]),
		]);
		expect(plan.textRepairs).toHaveLength(1);
		expect(unsure(plan)).toEqual([]);
	});

	// The run around it paired its element only because the difference was left to the inner run:
	// nothing tells "the same branch, with a difference inside" from "another branch".
	it("are every run's around a nested run that did not settle", () => {
		const plan = matchPlan(
			`<view><!--[0--><view class="a"><!--[0--><text class="b">x</text><!--]--></view><!--]--></view>`,
			[view(10, [block(0, [view(11, [block(0, [text(12, ["x"], "c")])], "a")])])],
		);
		expect(unsure(plan)).toEqual([11, 12, 1000]);
	});

	it("are a run's whose parent holds a text that differs, beside its blocks", () => {
		const plan = matchPlan(`<text>Shared: <!--[-1--><text class="go">Open</text><!--]--></text>`, [
			text(10, ["Yours: ", block(-1, [text(11, ["Open"], "go")])]),
		]);
		expect(unsure(plan)).toEqual([11, 1001]);
	});

	it("are a settled nested run's too, where the run around it did not settle", () => {
		const plan = matchPlan(
			`<view><!--[0--><view class="a"><!--[0--><text class="b">x</text><!--]--></view><!--]--></view>`,
			[view(10, [block(0, [view(11, [block(0, [text(12, ["x"], "b")])], "c")])])],
		);
		expect(unsure(plan)).toEqual([11, 12, 1000]);
	});
});
