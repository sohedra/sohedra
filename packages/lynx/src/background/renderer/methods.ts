// The methods of an element node that reach its Lynx element on the main thread: UI methods,
// styles set from code, computed styles and queries. Each rides in the patch after the ops made
// before it, so it sees the tree as the component left it.

import { sourceLocation } from "../../svelte/runtime/index.ts";
import type { CallRequest } from "../../wire/index.ts";
import { backgroundError } from "../catalogue.ts";
import type { BackgroundError } from "../catalogue.ts";
import type { TreeNode } from "./node.ts";
import type { PageLink } from "./page-link.ts";

/** What the methods reach of their renderer. */
interface MethodScope<Node extends TreeNode> {
	/** The link to the page; null when no page runs. */
	pageLink(): PageLink | null;
	/** The element node with this id, while it is on the page. */
	nodeById(id: number): Node | undefined;
}

/** The methods, for any node of one renderer. */
export interface ElementMethods<Node extends TreeNode> {
	/** `invoke(method, params)`: Lynx's UI method of the element, with its answer. */
	invoke(node: Node, call: { method: string; params: Record<string, unknown> }): Promise<unknown>;
	/** `getComputedStyleProperty(name)`: the value Lynx computed for one of the element's styles. */
	computedStyle(node: Node, name: string): Promise<string>;
	/** `querySelector(selector)`: the first element node under this one that `selector` matches. */
	querySelector(node: Node, selector: string): Promise<Node | null>;
	/** `querySelectorAll(selector)`: every element node under this one that `selector` matches. */
	querySelectorAll(node: Node, selector: string): Promise<Node[]>;
}

/** Whether `error` carries the catalogue code `code`. */
const isCode = (error: unknown, code: string): boolean =>
	typeof error === "object" && error !== null && "code" in error && error.code === code;

/** The error of a method called on a node that has no Lynx element. */
export function notOnPage(node: TreeNode, method: string): BackgroundError {
	return backgroundError({
		code: "element_not_on_page",
		details: { method, tag: node.tag ?? "", where: sourceLocation(node) },
	});
}

/** The error of a method called once the page is gone. */
export function pageGone(method: string): BackgroundError {
	return backgroundError({ code: "page_is_gone", details: { call: method } });
}

/** The methods of the nodes of one renderer. */
export function elementMethods<Node extends TreeNode>(
	scope: MethodScope<Node>,
): ElementMethods<Node> {
	/** Asks the main thread `request` about `node`'s element; rejects when it has none. */
	function ask(node: Node, method: string, request: CallRequest): Promise<unknown> {
		const pageLink = scope.pageLink();
		if (!pageLink) return Promise.reject(pageGone(method));
		if (node.lynxId === 0) return Promise.reject(notOnPage(node, method));
		return pageLink.call(node.lynxId, request).catch((error: unknown) => {
			// An element in a list cell is made only when Lynx shows the cell.
			if (node.cell !== 0 && isCode(error, "element_missing"))
				throw backgroundError({
					code: "element_not_shown",
					details: { method, tag: node.tag ?? "", where: sourceLocation(node) },
				});
			throw error;
		});
	}

	return {
		invoke: (node, { method, params }) => ask(node, method, ["invoke", method, params]),
		computedStyle: (node, name) =>
			ask(node, "getComputedStyleProperty", ["computed", name]).then((value) =>
				typeof value === "string" ? value : "",
			),
		querySelector: (node, selector) =>
			ask(node, "querySelector", ["query", selector]).then((id) =>
				typeof id === "number" ? (scope.nodeById(id) ?? null) : null,
			),
		querySelectorAll: (node, selector) =>
			ask(node, "querySelectorAll", ["queryAll", selector]).then((ids) => {
				const found: Node[] = [];
				if (!Array.isArray(ids)) return found;
				for (const id of ids) {
					const match = typeof id === "number" ? scope.nodeById(id) : undefined;
					if (match) found.push(match);
				}
				return found;
			}),
	};
}
