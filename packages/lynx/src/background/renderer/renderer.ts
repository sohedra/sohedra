// Svelte's custom renderer for Lynx: a tree of plain objects on the background, and the ops that
// make the main thread's Lynx elements follow it.
//
// A node gets a Lynx element, and ops, only once it is attached to the page, with the attributes
// and handlers it collected until then. Text gets one only inside a text element. Which ops travel
// with a list cell is the splitter's to decide (../split.ts); the renderer records each node's
// cell, so that a node that moves out of a cell is made again in its new place.

import type { createRenderer } from "svelte/renderer";

import { sourceLocation } from "../../svelte/runtime/index.ts";
import { listenerEvent, OpCode, ROOT_ID, TEXT_CONTAINERS } from "../../wire/index.ts";
import type { CallRequest, LynxEventType } from "../../wire/index.ts";
import { backgroundError } from "../catalogue.ts";
import { warnOnce } from "../report.ts";
import { elementClass } from "./element.ts";
import type { ElementNode, ListenerChange } from "./element.ts";
import type { Handler, HandlerRegistry } from "./handlers.ts";
import { setInputValue } from "./input.ts";
import type { InputHost } from "./input.ts";
import { TreeNode } from "./node.ts";
import type { OpQueue } from "./queue.ts";
import { link, nextRealAnchor, realContainer, topReals, unlink } from "./tree.ts";
import { attrValue, isFunction, textOf } from "./values.ts";

export type { ElementNode } from "./element.ts";

/** Where the renderer reaches the main thread for what an element is asked: the page's channel. */
export interface RendererHost {
	call(element: number, request: CallRequest): Promise<unknown>;
}

interface Nodes {
	fragment: TreeNode;
	element: TreeNode;
	text: TreeNode;
	comment: TreeNode;
}

/** Svelte's renderer interface, which `svelte/renderer` exports no name for. */
type SvelteRenderer = Parameters<typeof createRenderer<Nodes>>[0];

/** The renderer, with what the page asks of it. */
export interface LynxRenderer extends SvelteRenderer {
	/** The page's root: an element node the main thread binds to Lynx's page element. */
	createRoot(): ElementNode;
	/** The element node with this id, while it is on the page. */
	nodeById(id: number): ElementNode | undefined;
	/** The node as an event's target: it keeps the `uid` the event gave it. */
	eventTarget(node: ElementNode, target: { uid?: unknown }): ElementNode;
	/** Where element methods reach the main thread; null when no page runs. */
	setHost(host: RendererHost | null): void;
	/** The page is gone: its root is no longer Lynx's page element. */
	retire(): void;
	/** An element's tag by its id, for the text of an error. */
	tagOf(id: number): string | undefined;
}

/** What the renderer writes into and keeps. */
export interface RendererState {
	queue: OpQueue;
	handlers: HandlerRegistry;
}

/** Makes the renderer, writing its ops into `queue` and its handlers into `handlers`. */
export function createLynxRenderer({ queue, handlers }: RendererState): LynxRenderer {
	let nextId = ROOT_ID + 1;
	let host: RendererHost | null = null;
	let root: ElementNode | undefined;
	const elementsById = new Map<number, ElementNode>();
	const uids = new WeakMap<TreeNode, number>();
	const Element = elementClass({
		handlers,
		uids,
		root: () => root,
		setAttribute: (element, key, value) => setAttribute(element, key, value),
		setEvent: (element, change) => setEvent(element, change),
	});

	/** The cell of a node whose Lynx parent is `container`: a child of a page's list is a cell. */
	function cellUnder(container: TreeNode, node: TreeNode): number {
		return container.tag === "list" && container.cell === 0 ? node.lynxId : container.cell;
	}

	/**
	 * Gives `node`'s subtree Lynx elements, now that it is attached under `container`: the create,
	 * the attributes and handlers it collected, and its children joined in. The caller inserts
	 * `node` itself.
	 */
	function realize(node: TreeNode, container: TreeNode): void {
		if (node.kind === "text") {
			realizeText(node, container);
			return;
		}
		if (node.kind === "comment") return;
		if (node.kind === "fragment") {
			for (let child = node.first; child; child = child.next) realize(child, container);
			return;
		}
		if (node.lynxId !== 0) return;
		node.lynxId = nextId++;
		node.cell = cellUnder(container, node);
		// Boundary: every element node is made by `createElement`, from the element class.
		elementsById.set(node.lynxId, node as ElementNode);
		queue.push([OpCode.Create, node.lynxId, node.tag!]);
		if (node.attrs) {
			for (const [key, value] of node.attrs) {
				if (!isFunction(value))
					queue.push([OpCode.SetAttr, node.lynxId, key, attrValue(key, value)]);
			}
		}
		if (node.events) {
			for (const [slot, id] of node.events) {
				const colon = slot.indexOf(":");
				// Boundary: a slot's key is written by `setEvent` from a Lynx event type.
				const type = slot.slice(0, colon) as LynxEventType;
				queue.push([OpCode.SetEvent, node.lynxId, type, slot.slice(colon + 1), id]);
			}
		}
		for (let child = node.first; child; child = child.next) {
			realize(child, node);
			for (const real of topReals(child)) queue.push([OpCode.Insert, node.lynxId, real.lynxId, 0]);
		}
	}

	function realizeText(node: TreeNode, container: TreeNode): void {
		if (node.lynxId !== 0) return;
		const parent = node.parent;
		if (parent?.kind === "element" && TEXT_CONTAINERS.has(parent.tag!)) {
			node.lynxId = nextId++;
			node.cell = container.cell;
			queue.push([OpCode.CreateText, node.lynxId, node.data ?? ""]);
			return;
		}
		const text = node.data?.trim();
		if (parent?.kind === "element" && text) {
			const where = sourceLocation(parent);
			warnOnce(`text_outside_text:${where ?? `${parent.tag!}:${text}`}`, () =>
				backgroundError({
					code: "text_outside_text",
					details: { text: text.slice(0, 40), parent: parent.tag!, where },
				}),
			);
		}
	}

	/**
	 * Takes the Lynx elements of `node`'s subtree away and keeps the rest (attributes, handlers),
	 * so that it can be made again elsewhere.
	 */
	function unrealize(node: TreeNode): void {
		for (let child = node.first; child; child = child.next) unrealize(child);
		if (node.lynxId === 0) return;
		queue.push([OpCode.Release, node.lynxId]);
		elementsById.delete(node.lynxId);
		node.lynxId = 0;
		node.cell = 0;
	}

	function reflectInsert(node: TreeNode, container: TreeNode): void {
		const anchor = nextRealAnchor(node);
		for (const real of topReals(node))
			queue.push([OpCode.Insert, container.lynxId, real.lynxId, anchor ? anchor.lynxId : 0]);
	}

	function detach(node: TreeNode): void {
		if (!node.parent) return;
		const container = realContainer(node.parent);
		if (container)
			for (const real of topReals(node)) queue.push([OpCode.Remove, container.lynxId, real.lynxId]);
		unlink(node);
	}

	/** Lets go of a removed subtree: its handlers, and its Lynx elements for good. */
	function release(node: TreeNode): void {
		for (let child = node.first; child; child = child.next) release(child);
		if (node.events) {
			for (const id of node.events.values()) handlers.release(id);
			node.events = null;
		}
		if (node.lynxId !== 0 && node.lynxId !== ROOT_ID) {
			queue.push([OpCode.Release, node.lynxId]);
			elementsById.delete(node.lynxId);
			node.lynxId = 0;
		}
	}

	function insert(parent: TreeNode, node: TreeNode, anchor: TreeNode | null): void {
		if (node.kind === "fragment") {
			// A fragment's children move, and the fragment is left empty, as in the DOM.
			for (let child = node.first; child;) {
				const next = child.next;
				insert(parent, child, anchor);
				child = next;
			}
			return;
		}
		const madeIn = node.cell;
		detach(node);
		link(parent, node, anchor && anchor.parent === parent ? anchor : null);
		const container = realContainer(parent);
		if (!container) return;
		// A node made in a list cell travels with that cell, which the main thread may never open:
		// out of it, the node is made again where it goes.
		if (
			node.lynxId !== 0 &&
			madeIn !== 0 &&
			madeIn !== node.lynxId &&
			cellUnder(container, node) !== madeIn
		)
			unrealize(node);
		realize(node, container);
		reflectInsert(node, container);
	}

	function remove(node: TreeNode): void {
		if (node.kind === "fragment") {
			for (let child = node.first; child;) {
				const next = child.next;
				remove(child);
				child = next;
			}
			return;
		}
		detach(node);
		release(node);
	}

	function setText(node: TreeNode, text: string): void {
		if (node.kind === "element") {
			// `textContent`: one text node replaces the children.
			for (let child = node.first; child;) {
				const next = child.next;
				remove(child);
				child = next;
			}
			if (text !== "") {
				const child = new TreeNode("text");
				child.data = text;
				insert(node, child, null);
			}
			return;
		}
		node.data = text;
		if (node.kind === "text" && node.lynxId !== 0) queue.push([OpCode.SetText, node.lynxId, text]);
	}

	function setEvent(element: TreeNode, event: ListenerChange): void {
		const { type, name, handler, add } = event;
		// Kept on the node until it is made; `realize` binds it then.
		const key = `${type}:${name}`;
		element.events ??= new Map();
		let id = element.events.get(key);
		if (add) {
			if (id === undefined) {
				id = handlers.create();
				element.events.set(key, id);
				if (element.lynxId !== 0) queue.push([OpCode.SetEvent, element.lynxId, type, name, id]);
			}
			handlers.add(id, handler);
			return;
		}
		if (id === undefined || !handlers.remove(id, handler)) return;
		handlers.release(id);
		element.events.delete(key);
		if (element.lynxId !== 0) queue.push([OpCode.SetEvent, element.lynxId, type, name, 0]);
	}

	const inputHost: InputHost = {
		listen: (element, handler) =>
			setEvent(element, { type: "bindEvent", name: "input", handler, add: true }),
		setAttribute: (element, key, value) => setAttribute(element, key, value),
		invoke(element, method, params) {
			if (!host || element.lynxId === 0)
				return Promise.reject(new Error(`<${element.tag}> is not on the page.`));
			return host.call(element.lynxId, ["invoke", method, params]);
		},
	};

	function setAttribute(element: TreeNode, key: string, value: unknown): void {
		if (key === "value" && (element.tag === "input" || element.tag === "textarea")) {
			setInputValue(inputHost, element, value);
			return;
		}
		if (value == null) {
			if (!element.attrs?.delete(key)) return;
			if (element.lynxId !== 0) queue.push([OpCode.SetAttr, element.lynxId, key, null]);
			return;
		}
		const stored = key === "item-key" ? itemKey(element, value) : value;
		element.attrs ??= new Map();
		element.attrs.set(key, stored);
		if (element.lynxId !== 0 && !isFunction(stored))
			queue.push([OpCode.SetAttr, element.lynxId, key, attrValue(key, stored)]);
	}

	/**
	 * An `item-key` as text, which Lynx's list needs. A production build gives a keyed `{#each}`'s
	 * key as text already; a development build gives it as it is, so that a key that is neither a
	 * string nor a number is warned about here, naming the list item's place.
	 */
	function itemKey(element: TreeNode, value: unknown): string {
		if (typeof value === "string") return value;
		if (typeof value === "number") return String(value);
		const where = sourceLocation(element);
		warnOnce(`list_item_key_object:${where ?? ""}`, () =>
			backgroundError({ code: "list_item_key_object", details: { where } }),
		);
		return textOf(value);
	}

	/** Svelte routes `on()` here while an effect runs; a target that is not a node keeps its own API. */
	function listener(add: boolean) {
		return (
			target: TreeNode,
			type: string,
			handler: Handler,
			options?: { capture?: boolean },
		): void => {
			if (!(target instanceof Element)) {
				// Boundary: a target Svelte passes that is not a node, such as a media query list.
				const own = target as unknown as {
					addEventListener(type: string, handler: Handler, options?: unknown): void;
					removeEventListener(type: string, handler: Handler, options?: unknown): void;
				};
				if (add) own.addEventListener(type, handler, options);
				else own.removeEventListener(type, handler, options);
				return;
			}
			const { type: lynxType, name } = listenerEvent(type, options?.capture === true);
			setEvent(target, { type: lynxType, name, handler, add });
		};
	}

	return {
		createRoot() {
			const made = new Element("page");
			made.lynxId = ROOT_ID;
			elementsById.set(ROOT_ID, made);
			root = made;
			return made;
		},
		nodeById: (id) => elementsById.get(id),
		eventTarget(node, target) {
			if (typeof target.uid === "number") uids.set(node, target.uid);
			return node;
		},
		setHost(next) {
			host = next;
		},
		retire() {
			host = null;
			if (!root) return;
			if (root.events) for (const id of root.events.values()) handlers.release(id);
			root.events = null;
			root.lynxId = 0;
			elementsById.delete(ROOT_ID);
			root = undefined;
		},
		tagOf: (id) => elementsById.get(id)?.tag ?? undefined,

		createFragment: () => new TreeNode("fragment"),
		createElement: (name) => new Element(name),
		createTextNode(data) {
			const node = new TreeNode("text");
			node.data = data;
			return node;
		},
		createComment(data) {
			const node = new TreeNode("comment");
			node.data = data;
			return node;
		},
		nodeType: (node) => node.kind,
		getNodeValue: (node) => (node.kind === "text" || node.kind === "comment" ? node.data : null),
		getAttribute(element, name) {
			const value = element.attrs?.get(name);
			return value == null || isFunction(value) ? null : textOf(value);
		},
		hasAttribute: (element, name) => element.attrs?.has(name) ?? false,
		setAttribute,
		removeAttribute: (element, name) => setAttribute(element, name, null),
		setText,
		getFirstChild: (node) => node.first,
		getLastChild: (node) => node.last,
		getNextSibling: (node) => node.next,
		getParent: (node) => node.parent,
		insert,
		remove,
		addEventListener: listener(true),
		removeEventListener: listener(false),
	};
}
