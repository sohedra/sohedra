// The grammar's rules hold for the page as it renders, through snippets and child components: a
// long list renders only at the page level, with no list in its rows, and a list holds at most one
// more. A page that broke them nested tens of thousands of rows and never finished. And no page
// renders more than `MOST_ROWS` rows at once, whatever else nests them.

import { expect, it } from "@rstest/core";
import fc from "fast-check";

import { MOST_ROWS, pageModel } from "./grammar.ts";
import type { ComponentModel, PageModel } from "./grammar.ts";
import type { MarkupNode } from "./markup.ts";
import { check, RUNS, timeoutOf } from "./settings.ts";
import type { Pages } from "./settings.ts";
import { pageShape } from "./shape.ts";
import { describeSources, pageSources } from "./source.ts";

/**
 * A page takes milliseconds to make and walk, so this tries ten times the pages a rendering property
 * does, each with its own time. A page took 26 ms on average with the generated tests running at
 * once, and 113 ms on a loaded CI runner with both projects running it, at 300 runs; a quarter of a
 * second is over twice the most.
 */
const MODELS: Pages = { runs: RUNS * 10, each: 250 };

it(
	`nests no long list or list past a list's item, and renders at most ${MOST_ROWS} rows`,
	async () => {
		await check(
			fc.asyncProperty(pageModel, async (page) => {
				const shape = pageShape(page);
				const what = describeSources(pageSources(page));
				expect(shape.longInList, `A long list in a list:\n${what}`).toBe(false);
				expect(shape.listInRow, `A list in a long list's row:\n${what}`).toBe(false);
				expect(shape.deepest, `Lists too deep:\n${what}`).toBeLessThanOrEqual(2);
				expect(shape.rows, `Too many rows:\n${what}`).toBeLessThanOrEqual(MOST_ROWS);
			}),
			4,
			MODELS,
		);
	},
	timeoutOf(MODELS),
);

/** A list of long rows, each holding `body`. */
const longList = (body: MarkupNode[]): MarkupNode => ({
	kind: "list",
	attributes: [],
	screen: [],
	items: [{ kind: "rows", item: "item0", fixed: false, attributes: [], body }],
});

/** A page of `components`, the root last. */
const pageOf = (...components: Omit<ComponentModel, "context" | "uid">[]): PageModel => ({
	components: components.map((component) => ({ context: "block", uid: false, ...component })),
	data: { s0: "", s1: "", s2: "", b0: false, b1: false, n0: 0, a0: [], a1: [], t0: "view" },
	fromTemplate: [],
	indented: false,
	production: false,
});

it("counts rows through snippets and components, as the runaway page nested them", () => {
	// The runaway page at seed 11, made smaller: a long list whose rows render a snippet twice,
	// which holds a long list whose rows render a component, which holds a long list. 26 rows each.
	const page = pageOf(
		{ name: "Child0", lists: 0, snippets: [], body: [longList([])] },
		{
			name: "App",
			lists: 0,
			snippets: [
				{
					name: "piece0",
					context: "block",
					lists: 0,
					body: [
						longList([{ kind: "component", name: "Child0", label: '"lit"', cssVariable: false }]),
					],
				},
			],
			body: [
				longList([
					{ kind: "render", snippet: "piece0", argument: '"lit"' },
					{ kind: "render", snippet: "piece0", argument: '"lit"' },
				]),
			],
		},
	);
	expect(pageShape(page)).toEqual({
		deepest: 3,
		longInList: true,
		listInRow: true,
		// 26 × (1 + 2 × 26 × (1 + 26))
		rows: 36_530,
	});
});

it("counts an {#each} at its longest, and an {#if} by its larger branch", () => {
	const oneItem: MarkupNode = {
		kind: "list",
		attributes: [],
		screen: [],
		items: [{ kind: "item", key: "s0", attributes: [], body: [] }],
	};
	const page = pageOf({
		name: "App",
		lists: 0,
		snippets: [],
		body: [
			{
				kind: "each",
				array: "st.a0",
				item: "item0",
				keyed: false,
				body: [oneItem],
				otherwise: [oneItem],
			},
			{ kind: "if", condition: "st.b0", consequent: [oneItem, oneItem], otherwise: [oneItem] },
		],
	});
	// Five items at most, and two lists of one item.
	expect(pageShape(page).rows).toBe(5 + 2);
});
