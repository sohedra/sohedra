// A generated page's shape as it renders: where its lists are, through `{@render}` and the child
// components it uses, not as each component's markup reads alone.

import type { ComponentModel, PageModel } from "./grammar.ts";
import type { MarkupNode } from "./markup.ts";

/** Where a page's lists render. */
export interface PageShape {
	/** The most lists that render one inside another. */
	deepest: number;
	/** Whether a long list renders inside another list. */
	longInList: boolean;
	/** Whether a list renders inside a long list's row. */
	listInRow: boolean;
}

/** Walks the page from its root, into each snippet and component where it is rendered. */
export function pageShape(page: PageModel): PageShape {
	const named = new Map(page.components.map((component) => [component.name, component]));
	const shape: PageShape = { deepest: 0, longInList: false, listInRow: false };

	/** `lists`: the lists around. `inRow`: whether a long list's row is among them. */
	function walk(
		nodes: readonly MarkupNode[],
		owner: ComponentModel,
		lists: number,
		inRow: boolean,
	): void {
		for (const node of nodes) {
			switch (node.kind) {
				case "element":
				case "dynamic":
					walk(node.children, owner, lists, inRow);
					break;
				case "if":
					walk(node.consequent, owner, lists, inRow);
					walk(node.otherwise ?? [], owner, lists, inRow);
					break;
				case "each":
					walk(node.body, owner, lists, inRow);
					walk(node.otherwise ?? [], owner, lists, inRow);
					break;
				case "key":
					walk(node.body, owner, lists, inRow);
					break;
				case "component": {
					const used = named.get(node.name)!;
					walk(used.body, used, lists, inRow);
					break;
				}
				case "render": {
					const rendered = owner.snippets.find((snippet) => snippet.name === node.snippet)!;
					walk(rendered.body, owner, lists, inRow);
					break;
				}
				case "list":
					shape.deepest = Math.max(shape.deepest, lists + 1);
					if (inRow) shape.listInRow = true;
					for (const child of node.items) {
						if (child.kind === "rows" && lists > 0) shape.longInList = true;
						walk(child.body, owner, lists + 1, inRow || child.kind === "rows");
					}
					break;
				case "text":
					break;
			}
		}
	}

	const root = page.components.at(-1)!;
	walk(root.body, root, 0, false);
	return shape;
}
