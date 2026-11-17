// The element nodes a component sees, through an attachment, `use:` or an event's target: the
// tree questions of the DOM, their attributes and their listeners, answered from the renderer's
// tree.

import { listenerEvent } from "../../wire/index.ts";
import type { LynxEventType } from "../../wire/index.ts";
import type { Handler, HandlerRegistry } from "./handlers.ts";
import { TreeNode } from "./node.ts";
import { compareNodes, topOf } from "./tree.ts";
import { attrValue, isFunction, textOf } from "./values.ts";

/**
 * What an element node offers a component, through an attachment, `use:` or an event's target:
 * DOM-like tree questions, its attributes and listeners.
 */
export interface ElementNode extends TreeNode {
	/** The `id` attribute, as Lynx reports it in an event's target: "" when there is none. */
	readonly id: string;
	/** Lynx's unique id of the element, as of the last event that had it as a target. */
	readonly uid: number | undefined;
	/** The `data-*` attributes, as Lynx reports them in an event's target. Built when read. */
	readonly dataset: Record<string, unknown>;
	/** Whether the node is on the page: its topmost ancestor is the page's root. */
	readonly isConnected: boolean;
	/** The element that holds this one; null for the root, a removed node, or a holder that is no element. */
	readonly parentElement: ElementNode | null;
	/** Whether `other` is this node or inside it. */
	contains(other: unknown): boolean;
	/**
	 * Tree order: below 0 when this node comes first, above 0 when `other` does. Of two nodes in
	 * separate trees, the one on the page comes first; 0 when neither is.
	 */
	compareOrder(other: unknown): number;
	/** The attribute's value as it was set; `null` for an absent one and for a function. */
	getAttribute(name: string): unknown;
	/** The names of the attributes that have a value. */
	getAttributeNames(): string[];
	setAttribute(name: string, value: unknown): void;
	addEventListener(type: string, handler: Handler, options?: { capture?: boolean }): void;
	removeEventListener(type: string, handler: Handler, options?: { capture?: boolean }): void;
	/** Runs this element's own listeners of `event.type`, with no propagation. */
	dispatchEvent(event: { type: string }): boolean;
}

/** A listener added to or taken from an element's event slot. */
export interface ListenerChange {
	type: LynxEventType;
	name: string;
	handler: Handler;
	add: boolean;
}

/** What an element node reaches of its renderer. */
export interface ElementScope {
	handlers: HandlerRegistry;
	/** Lynx's unique id of each node, as of the last event that had it as a target. */
	uids: WeakMap<TreeNode, number>;
	/** The page's root, while a page runs. */
	root(): TreeNode | undefined;
	setAttribute(element: TreeNode, key: string, value: unknown): void;
	setEvent(element: TreeNode, change: ListenerChange): void;
}

/** The class of a renderer's element nodes. */
export type ElementClass = new (tag: string) => ElementNode;

/** The class of the element nodes of one renderer: its methods reach that renderer's tree. */
export function elementClass(scope: ElementScope): ElementClass {
	class Element extends TreeNode implements ElementNode {
		constructor(tag: string) {
			super("element");
			this.tag = tag;
		}

		get id(): string {
			const value = this.attrs?.get("id");
			return value == null ? "" : textOf(value);
		}

		get uid(): number | undefined {
			return scope.uids.get(this);
		}

		get dataset(): Record<string, unknown> {
			// The main thread's rule (`__SetDataset`): the `data-*` attributes, without the prefix, as
			// they are sent.
			const dataset: Record<string, unknown> = {};
			if (this.attrs !== null) {
				for (const [key, value] of this.attrs) {
					if (!key.startsWith("data-")) continue;
					const sent = attrValue(key, value);
					if (sent !== null) dataset[key.slice(5)] = sent;
				}
			}
			return dataset;
		}

		get isConnected(): boolean {
			return topOf(this) === scope.root() && scope.root() !== undefined;
		}

		get parentElement(): ElementNode | null {
			return this.parent instanceof Element ? this.parent : null;
		}

		contains(other: unknown): boolean {
			if (!(other instanceof TreeNode)) return false;
			for (let node: TreeNode | null = other; node; node = node.parent)
				if (node === this) return true;
			return false;
		}

		compareOrder(other: unknown): number {
			return this === other || !(other instanceof Element)
				? 0
				: compareNodes(this, other, scope.root());
		}

		getAttribute(name: string): unknown {
			const value = this.attrs?.get(name);
			return value === undefined || isFunction(value) ? null : value;
		}

		getAttributeNames(): string[] {
			const attrs = this.attrs;
			return attrs ? [...attrs.keys()].filter((key) => !isFunction(attrs.get(key))) : [];
		}

		setAttribute(name: string, value: unknown): void {
			scope.setAttribute(this, name, value);
		}

		addEventListener(type: string, handler: Handler, options?: { capture?: boolean }): void {
			const { type: lynxType, name } = listenerEvent(type, options?.capture === true);
			scope.setEvent(this, { type: lynxType, name, handler, add: true });
		}

		removeEventListener(type: string, handler: Handler, options?: { capture?: boolean }): void {
			const { type: lynxType, name } = listenerEvent(type, options?.capture === true);
			scope.setEvent(this, { type: lynxType, name, handler, add: false });
		}

		dispatchEvent(event: { type: string }): boolean {
			const id = this.events?.get(`bindEvent:${event.type}`);
			if (id !== undefined)
				scope.handlers.dispatch(id, { target: this, ...event, currentTarget: this });
			return true;
		}
	}

	return Element;
}
