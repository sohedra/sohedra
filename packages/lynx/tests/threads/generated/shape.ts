// A generated page's shape as it renders: where its lists are and how many rows they have, through
// `{@render}` and the child components it uses, not as each component's markup reads alone.

import type { ComponentModel, PageModel } from "./grammar.ts";
import type { MarkupNode } from "./markup.ts";
import { LONG_ROWS } from "./source.ts";
import { MOST_ITEMS } from "./state.ts";

/** Where a page's lists render, and how many rows they have. */
export interface PageShape {
	/** The most lists that render one inside another. */
	deepest: number;
	/** Whether a long list renders inside another list. */
	longInList: boolean;
	/** Whether a list renders inside a long list's row. */
	listInRow: boolean;
	/**
	 * The most `<list-item>`s it renders at once, in all its lists: every `{#each}` at its longest,
	 * the larger branch of each `{#if}`.
	 */
	rows: number;
}

/** Walks the page from its root, into each snippet and component where it is rendered. */
export function pageShape(page: PageModel): PageShape {
	const named = new Map(page.components.map((component) => [component.name, component]));
	const shape: PageShape = { deepest: 0, longInList: false, listInRow: false, rows: 0 };

	/**
	 * The most rows `nodes` render at once. `lists`: the lists around. `inRow`: whether a long
	 * list's row is among them.
	 */
	function walk(
		nodes: readonly MarkupNode[],
		owner: ComponentModel,
		lists: number,
		inRow: boolean,
	): number {
		let rows = 0;
		for (const node of nodes) {
			switch (node.kind) {
				case "element":
				case "dynamic":
					rows += walk(node.children, owner, lists, inRow);
					break;
				case "if":
					rows += Math.max(
						walk(node.consequent, owner, lists, inRow),
						walk(node.otherwise ?? [], owner, lists, inRow),
					);
					break;
				case "each":
					rows += Math.max(
						MOST_ITEMS * walk(node.body, owner, lists, inRow),
						walk(node.otherwise ?? [], owner, lists, inRow),
					);
					break;
				case "key":
					rows += walk(node.body, owner, lists, inRow);
					break;
				case "component": {
					const used = named.get(node.name)!;
					rows += walk(used.body, used, lists, inRow);
					break;
				}
				case "render": {
					const rendered = owner.snippets.find((snippet) => snippet.name === node.snippet)!;
					rows += walk(rendered.body, owner, lists, inRow);
					break;
				}
				case "list":
					shape.deepest = Math.max(shape.deepest, lists + 1);
					if (inRow) shape.listInRow = true;
					for (const child of node.items) {
						if (child.kind === "rows" && lists > 0) shape.longInList = true;
						const count =
							child.kind === "item" ? 1 : child.kind === "items" ? MOST_ITEMS : LONG_ROWS;
						const inside = walk(child.body, owner, lists + 1, inRow || child.kind === "rows");
						rows += count * (1 + inside);
					}
					break;
				case "text":
					break;
			}
		}
		return rows;
	}

	const root = page.components.at(-1)!;
	shape.rows = walk(root.body, root, 0, false);
	return shape;
}
