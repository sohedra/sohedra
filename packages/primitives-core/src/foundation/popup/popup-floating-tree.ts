// The floating tree of nested popups: its nodes, the events the tree shares, and queries over its
// nodes. The platform creates the tree in the outermost popup Root and hands it to each nested
// popup's store; core never reads a context.

import type { PlatformEvent, PlatformTypes, REASONS } from "../kernel/index.js";
import { EventEmitter } from "./popup-event-emitter.js";

/** Events shared by a tree of nested popups (`floating.closed`, from a hover close). */
export type FloatingTreeEvents<T extends PlatformTypes = PlatformTypes> = {
	"floating.closed": PlatformEvent<T, typeof REASONS.triggerHover>;
};

/** What the tree knows about a popup: enough to decide dismissal and focus across nesting. */
export interface FloatingNodeContextValue<T extends PlatformTypes = PlatformTypes> {
	readonly open: boolean;
	/** The positioned element. */
	readonly floatingElement: T["element"] | null;
	readonly anchorElement: T["element"] | null;
	/** Whether Escape / outside presses in this popup also reach its ancestors (`bubbles`). */
	readonly dismissBubbles: { escapeKey: boolean; outsidePress: boolean };
	/** Whether an interaction is passing through the popup's own elements right now. */
	readonly data: { insideTree: boolean };
}

export interface FloatingNode<T extends PlatformTypes = PlatformTypes> {
	readonly id: string;
	readonly parentId: string | null;
	context: FloatingNodeContextValue<T> | null;
}

/**
 * Nested popups in one tree, so a parent knows its open children without asking the platform: a press
 * inside a portalled child isn't outside the parent, and Escape closes only the innermost.
 */
export class FloatingTree<T extends PlatformTypes = PlatformTypes> {
	readonly nodes: FloatingNode<T>[] = [];
	readonly events = new EventEmitter<FloatingTreeEvents<T>>();

	addNode(node: FloatingNode<T>): void {
		this.nodes.push(node);
	}

	removeNode(node: FloatingNode<T>): void {
		const index = this.nodes.indexOf(node);
		if (index !== -1) {
			this.nodes.splice(index, 1);
		}
	}

	/** The descendants of node `id`, depth first; only open ones (and their subtrees) by default. */
	children(id: string | undefined | null, onlyOpenChildren = true): FloatingNode<T>[] {
		return getNodeChildren(this.nodes, id, onlyOpenChildren);
	}

	/** The ancestors of node `id`, nearest first. */
	ancestors(id: string | undefined | null): FloatingNode<T>[] {
		return getNodeAncestors(this.nodes, id);
	}
}

/** The descendants of node `id`, depth first; only open ones (and their subtrees) by default. */
function getNodeChildren<T extends PlatformTypes>(
	nodes: readonly FloatingNode<T>[],
	id: string | undefined | null,
	onlyOpenChildren = true,
): FloatingNode<T>[] {
	const directChildren = nodes.filter((node) => node.parentId === id);
	return directChildren.flatMap((child) => [
		...(!onlyOpenChildren || child.context?.open ? [child] : []),
		...getNodeChildren(nodes, child.id, onlyOpenChildren),
	]);
}

/** The ancestors of node `id`, nearest first. */
function getNodeAncestors<T extends PlatformTypes>(
	nodes: readonly FloatingNode<T>[],
	id: string | undefined | null,
): FloatingNode<T>[] {
	const ancestors: FloatingNode<T>[] = [];
	let parentId = nodes.find((node) => node.id === id)?.parentId;
	while (parentId) {
		const current = nodes.find((node) => node.id === parentId);
		parentId = current?.parentId;
		if (current) {
			ancestors.push(current);
		}
	}
	return ancestors;
}
