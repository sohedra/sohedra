// The popup tree of nested popups: its nodes, the events the tree shares, and queries over its
// nodes. The platform creates the tree in the outermost popup Root and hands it to each nested
// popup's store; core never reads a context.

import type { PlatformEvent, PlatformTypes, REASONS } from "../kernel/index.js";
import { EventEmitter } from "./popup-event-emitter.js";
import type { PopupView } from "./popup-view.js";

/** Events shared by a tree of nested popups (`popup.closed`, from a hover close). */
export type PopupTreeEvents<T extends PlatformTypes = PlatformTypes> = {
	"popup.closed": PlatformEvent<T, typeof REASONS.triggerHover>;
};

export interface PopupNode<T extends PlatformTypes = PlatformTypes> {
	readonly id: string;
	readonly parentId: string | null;
	/** What the tree knows about the popup: enough to decide dismissal and focus across nesting. */
	context: Pick<
		PopupView<T>,
		"open" | "positionerElement" | "anchorElement" | "dismissBubbles"
	> | null;
}

/**
 * Nested popups in one tree, so a parent knows its open children without asking the platform: a press
 * inside a portalled child isn't outside the parent, and Escape closes only the innermost.
 */
export class PopupTree<T extends PlatformTypes = PlatformTypes> {
	/** The nodes of the tree, in the order they joined. */
	readonly nodes: PopupNode<T>[] = [];
	/** The tree's events, which nested popups follow. */
	readonly events: EventEmitter<PopupTreeEvents<T>> = new EventEmitter<PopupTreeEvents<T>>();
	// The nodes a press inside a popup nested in them is passing through, until the next task.
	// Read when input arrives and never rendered, so not reactive.
	readonly #inside = new Set<string>();

	/** Adds a popup's node. */
	addNode(node: PopupNode<T>): void {
		this.nodes.push(node);
	}

	/** Removes a popup's node. */
	removeNode(node: PopupNode<T>): void {
		const index = this.nodes.indexOf(node);
		if (index !== -1) {
			this.nodes.splice(index, 1);
		}
	}

	/** The descendants of node `id`, depth first; only open ones (and their subtrees) by default. */
	children(id: string | undefined | null, onlyOpenChildren = true): PopupNode<T>[] {
		return getNodeChildren(this.nodes, id, onlyOpenChildren);
	}

	/** The ancestors of node `id`, nearest first. */
	ancestors(id: string | undefined | null): PopupNode<T>[] {
		return getNodeAncestors(this.nodes, id);
	}

	/** Whether a press from a popup nested in node `id` is passing through it. */
	isInside(id: string | undefined): boolean {
		return id !== undefined && this.#inside.has(id);
	}

	/** A press from a popup nested in node `id` is passing through it. */
	markInside = (id: string): void => {
		this.#inside.add(id);
	};

	/** No press from a nested popup is passing through node `id` any more. */
	clearInside = (id: string): void => {
		this.#inside.delete(id);
	};
}

/** The descendants of node `id`, depth first; only open ones (and their subtrees) by default. */
function getNodeChildren<T extends PlatformTypes>(
	nodes: readonly PopupNode<T>[],
	id: string | undefined | null,
	onlyOpenChildren = true,
): PopupNode<T>[] {
	const directChildren = nodes.filter((node) => node.parentId === id);
	return directChildren.flatMap((child) => [
		...(!onlyOpenChildren || child.context?.open ? [child] : []),
		...getNodeChildren(nodes, child.id, onlyOpenChildren),
	]);
}

/** The ancestors of node `id`, nearest first. */
function getNodeAncestors<T extends PlatformTypes>(
	nodes: readonly PopupNode<T>[],
	id: string | undefined | null,
): PopupNode<T>[] {
	const ancestors: PopupNode<T>[] = [];
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
