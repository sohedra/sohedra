// Which adopted nodes hydration's match is not sure of: those a run of Svelte blocks paired by
// their shape, when the run did not pair one to one or hydration wrote over what it adopted. An
// early event on one of them is not replayed.

import { describe, expect, it } from "@rstest/core";

import { parsePage } from "../../../src/main-thread/frame/html.ts";
import { matchFrame } from "../../../src/main-thread/hydrate/match.ts";
import type { Plan } from "../../../src/main-thread/hydrate/match.ts";
import { readRendered } from "../../../src/main-thread/hydrate/rendered.ts";
import { OpCode, ROOT_ID } from "../../../src/wire/index.ts";
import type { Op } from "../../../src/wire/index.ts";

/** A node the background rendered: an element with its class and children, or a text. */
type Built = string | { id: number; tag: string; class?: string; children?: Built[] };

/** Text ids, counted apart from the elements' own, from 1000 for each page. */
let nextText = 1000;

/** The ops that make `built` under `parent`, each child appended. */
function opsOf(parent: number, built: Built, out: Op[]): void {
	if (typeof built === "string") {
		const id = nextText++;
		out.push([OpCode.CreateText, id, built]);
		out.push([OpCode.Insert, parent, id, 0]);
		return;
	}
	out.push([OpCode.Create, built.id, built.tag]);
	if (built.class !== undefined) out.push([OpCode.SetAttr, built.id, "class", built.class]);
	for (const child of built.children ?? []) opsOf(built.id, child, out);
	out.push([OpCode.Insert, parent, built.id, 0]);
}

/** Matches the first frame drawn from `markup` against the page `built`; the drawn ids start at 2. */
function match(markup: string, built: Built[]): Plan {
	let next = ROOT_ID;
	nextText = 1000;
	const root = parsePage(markup, ROOT_ID, () => ++next);
	const ops: Op[] = [];
	for (const child of built) opsOf(ROOT_ID, child, ops);
	const plan = matchFrame({
		root,
		rendered: readRendered([["ops", ops]], 1),
		lists: { held: () => new Map() },
	});
	if ("mismatch" in plan) throw new Error(`refused: ${JSON.stringify(plan.mismatch)}`);
	return plan;
}

/** The background's ids of the unsure nodes, in order. */
const unsure = (plan: Plan): number[] => [...plan.unsure].sort((a, b) => a - b);

const view = (id: number, children: Built[] = [], tone?: string): Built => ({
	id,
	tag: "view",
	...(tone !== undefined && { class: tone }),
	children,
});
const text = (id: number, children: Built[] = [], tone?: string): Built => ({
	id,
	tag: "text",
	...(tone !== undefined && { class: tone }),
	children,
});

describe("the nodes hydration is not sure of", () => {
	it("are none outside every block", () => {
		const plan = match(`<view class="a"><text>x</text></view>`, [view(10, [text(11, ["x"])], "a")]);
		expect(plan.adopt).toHaveLength(3);
		expect(unsure(plan)).toEqual([]);
	});

	it("are none in a run that paired one to one, with nothing written", () => {
		const plan = match(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
			view(10, [text(11, ["x"], "a")]),
		]);
		expect(unsure(plan)).toEqual([]);
	});

	it("are what a run that made something again adopted, and what is under it", () => {
		const plan = match(
			`<view><!--[0--><view class="a"><text>x</text></view><!--]--><!--[-1--><!--]--></view>`,
			[view(10, [view(11, [text(12, ["x"])], "a"), view(13, [], "a")])],
		);
		expect(plan.repairs).toHaveLength(1);
		expect(unsure(plan)).toEqual([11, 12, 1000]);
	});

	it("are what a run wrote an attribute over", () => {
		const plan = match(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
			view(10, [text(11, ["x"], "b")]),
		]);
		expect(unsure(plan)).toEqual([11, 1000]);
	});

	it("are what a run wrote a text over", () => {
		const plan = match(`<view><!--[0--><text class="a">x</text><!--]--></view>`, [
			view(10, [text(11, ["y"], "a")]),
		]);
		expect(unsure(plan)).toEqual([11, 1000]);
	});

	it("are none where a run wrote only the ids of $props.id()", () => {
		const plan = match(`<view><!--[0--><text class="lynx-s1">x</text><!--]--></view>`, [
			view(10, [text(11, ["x"], "lynx-b1")]),
		]);
		expect(plan.writes).toHaveLength(1);
		expect(unsure(plan)).toEqual([]);
	});

	it("are none where a run made only texts that are empty", () => {
		const plan = match(`<view><!--[0--><text class="a"></text><!--]--></view>`, [
			view(10, [text(11, [""], "a")]),
		]);
		expect(plan.textRepairs).toHaveLength(1);
		expect(unsure(plan)).toEqual([]);
	});

	it("are only a nested run's, where it did not settle and the run around it did", () => {
		const plan = match(
			`<view><!--[0--><view class="a"><!--[0--><text class="b">x</text><!--]--></view><!--]--></view>`,
			[view(10, [view(11, [text(12, ["x"], "c")], "a")])],
		);
		expect(unsure(plan)).toEqual([12, 1000]);
	});

	it("are a settled nested run's too, where the run around it did not settle", () => {
		const plan = match(
			`<view><!--[0--><view class="a"><!--[0--><text class="b">x</text><!--]--></view><!--]--></view>`,
			[view(10, [view(11, [text(12, ["x"], "b")], "c")])],
		);
		expect(unsure(plan)).toEqual([11, 12, 1000]);
	});
});
