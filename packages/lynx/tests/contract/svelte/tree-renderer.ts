// A renderer that keeps its nodes in plain objects and records what it is asked to insert and
// remove. Compiled components import it by its file, and the tests load it with Node, so both
// reach the same instance.

import { createRenderer } from "svelte/renderer";

interface TreeNode {
	type: "fragment" | "element" | "text" | "comment";
	name?: string;
	data?: string;
	children: TreeNode[];
	parent: TreeNode | null;
	attributes: Record<string, unknown>;
}

/** The inserts, removes and attributes the renderer was asked for, in order. */
export const log: string[] = [];

const make = (type: TreeNode["type"], extra: Partial<TreeNode> = {}): TreeNode => ({
	type,
	children: [],
	parent: null,
	attributes: {},
	...extra,
});

const detach = (node: TreeNode): void => {
	node.parent?.children.splice(node.parent.children.indexOf(node), 1);
	node.parent = null;
};

/** A new root for `mount`'s `target`. */
export function createRoot(): TreeNode {
	return make("fragment");
}

interface Nodes {
	fragment: TreeNode;
	element: TreeNode;
	text: TreeNode;
	comment: TreeNode;
}

const renderer: Parameters<typeof createRenderer<Nodes>>[0] = createRenderer<Nodes>({
	createFragment: () => make("fragment"),
	createElement: (name: string) => make("element", { name }),
	createText: (data: string) => make("text", { data }),
	createComment: (data: string) => make("comment", { data }),
	getNodeType: (node: TreeNode) => node.type,
	getText: (node: TreeNode) => node.data ?? null,
	getAttribute: (element: TreeNode, name: string) =>
		name in element.attributes ? String(element.attributes[name]) : null,
	setAttribute: (element: TreeNode, name: string, value: unknown) => {
		element.attributes[name] = value;
		log.push(`set ${element.name} ${name}`);
	},
	removeAttribute: (element: TreeNode, name: string) => {
		delete element.attributes[name];
	},
	hasAttribute: (element: TreeNode, name: string) => name in element.attributes,
	setText: (node: TreeNode, text: string) => {
		node.data = text;
	},
	getFirstChild: (node: TreeNode) => node.children[0] ?? null,
	getLastChild: (node: TreeNode) => node.children.at(-1) ?? null,
	getNextSibling: (node: TreeNode) => {
		const siblings = node.parent?.children ?? [];
		return siblings[siblings.indexOf(node) + 1] ?? null;
	},
	insert: (parent: TreeNode, node: TreeNode, anchor: TreeNode | null) => {
		detach(node);
		parent.children.splice(
			anchor ? parent.children.indexOf(anchor) : parent.children.length,
			0,
			node,
		);
		node.parent = parent;
		log.push(`insert ${node.name ?? node.type}`);
	},
	remove: (node: TreeNode) => {
		detach(node);
		log.push(`remove ${node.name ?? node.type}`);
	},
	getParent: (node: TreeNode) => node.parent,
	addEventListener: () => {},
	removeEventListener: () => {},
});

export default renderer;
