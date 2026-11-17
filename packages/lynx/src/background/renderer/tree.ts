// The shape of the tree: where a node is, what comes before it, and which nodes have a Lynx
// element.

import type { TreeNode } from "./node.ts";

/** The topmost ancestor of a node: itself, when it has no parent. */
export function topOf(node: TreeNode): TreeNode {
	let top = node;
	while (top.parent) top = top.parent;
	return top;
}

/**
 * Tree order of two different nodes: below 0 when `first` comes first (a node comes before what
 * is inside it), above 0 when `second` does. Of two nodes in separate trees, the one whose top is
 * `page` comes first; 0 when neither is on it.
 */
export function compareNodes(
	first: TreeNode,
	second: TreeNode,
	page: TreeNode | undefined,
): number {
	let a = first;
	let b = second;
	let depthA = 0;
	let depthB = 0;
	for (let node = a.parent; node; node = node.parent) depthA++;
	for (let node = b.parent; node; node = node.parent) depthB++;
	// Climb the deeper node to the depth of the other: if that reaches the other, it was inside it.
	for (; depthA > depthB; depthA--) a = a.parent!;
	if (a === b) return 1;
	for (; depthB > depthA; depthB--) b = b.parent!;
	if (a === b) return -1;
	while (a.parent !== b.parent) {
		a = a.parent!;
		b = b.parent!;
	}
	if (a.parent === null) return a === page ? -1 : b === page ? 1 : 0;
	// Siblings: walk from both towards the end at once, so the cost is the distance between them,
	// not their place in a long list.
	let after: TreeNode | null = a.next;
	let before: TreeNode | null = b.next;
	while (after !== null || before !== null) {
		if (after === b) return -1;
		if (before === a) return 1;
		after = after && after.next;
		before = before && before.next;
	}
	return 0;
}

/** Puts `node` under `parent`, before `before` (at the end for null). It has no parent yet. */
export function link(parent: TreeNode, node: TreeNode, before: TreeNode | null): void {
	node.parent = parent;
	node.next = before;
	node.prev = before ? before.prev : parent.last;
	if (node.prev) node.prev.next = node;
	else parent.first = node;
	if (before) before.prev = node;
	else parent.last = node;
}

/** Takes `node` out of its parent's children. */
export function unlink(node: TreeNode): void {
	const parent = node.parent;
	if (!parent) return;
	if (node.prev) node.prev.next = node.next;
	else parent.first = node.next;
	if (node.next) node.next.prev = node.prev;
	else parent.last = node.prev;
	node.parent = node.prev = node.next = null;
}

/** The nearest element, itself included, that has a Lynx element, across fragments only. */
export function realContainer(node: TreeNode | null): TreeNode | null {
	let current = node;
	while (current && !(current.kind === "element" && current.lynxId !== 0)) {
		// Crossing an element without a Lynx element would leave its subtree.
		if (current.kind !== "fragment") return null;
		current = current.parent;
	}
	return current;
}

/** The shallowest nodes of a subtree that have a Lynx element, in order. */
export function topReals(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
	if (node.lynxId !== 0) out.push(node);
	else for (let child = node.first; child; child = child.next) topReals(child, out);
	return out;
}

function firstReal(node: TreeNode): TreeNode | null {
	if (node.lynxId !== 0) return node;
	for (let child = node.first; child; child = child.next) {
		const real = firstReal(child);
		if (real) return real;
	}
	return null;
}

/** The node with a Lynx element after `node` under the same Lynx parent; null appends. */
export function nextRealAnchor(node: TreeNode): TreeNode | null {
	let current: TreeNode = node;
	while (current.parent) {
		for (let sibling = current.next; sibling; sibling = sibling.next) {
			const real = firstReal(sibling);
			if (real) return real;
		}
		if (current.parent.lynxId !== 0) return null;
		current = current.parent;
	}
	return null;
}
