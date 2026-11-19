// Svelte's custom renderer for Lynx: a tree of plain objects on the background, and the ops that
// make the main thread's Lynx elements follow it.
//
// A node gets a Lynx element, and ops, only once it is attached to the page, with the attributes
// and handlers it collected until then. Text gets one only inside a text element. Which ops travel
// with a list cell is the splitter's to decide (../split.ts); the renderer records each node's
// cell, so that a node that moves out of a cell is made again in its new place.

import type { createRenderer } from "svelte/renderer";

import { sourceLocation } from "../../svelte/runtime/index.ts";
import {
	DEFER,
	DEFERRED_ROW,
	isGesture,
	MAIN_THREAD_PREFIX,
	OpCode,
	removedEventSpelling,
	ROOT_ID,
	TEXT_CONTAINERS,
} from "../../wire/index.ts";
import type { LynxEventType } from "../../wire/index.ts";
import { backgroundError } from "../catalogue.ts";
import { background, DEV } from "../globals.ts";
import { reportOnce, warnOnce } from "../report.ts";
import { elementClass, svelteListener } from "./element.ts";
import type { ElementNode, ListenerChange } from "./element.ts";
import type { HandlerRegistry } from "./handlers.ts";
import type { RendererHost } from "./host.ts";
import { setInputValue } from "./input.ts";
import type { InputHost } from "./input.ts";
import { itemKey } from "./item-key.ts";
import { lateLayouts } from "./layout.ts";
import { TreeNode } from "./node.ts";
import type { OpQueue } from "./queue.ts";
import { linkRow, rowOf } from "./rows.ts";
import { link, nextRealAnchor, realContainer, topReals, unlink } from "./tree.ts";
import { attrValue, isFunction, isRecord, textOf } from "./values.ts";

export type { ElementNode } from "./element.ts";
export type { RendererHost } from "./host.ts";

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
	/**
	 * The page's root: one element node for the renderer's life, which the main thread binds to
	 * Lynx's page element while a page runs.
	 */
	readonly root: ElementNode;
	/**
	 * A page starts: the root becomes Lynx's page element again, with the listeners it was given
	 * while no page ran. Returns the root.
	 */
	attachRoot(): ElementNode;
	/** The element node with this id, while it is on the page. */
	nodeById(id: number): ElementNode | undefined;
	/** The node as an event's target: it keeps the `uid` the event gave it. */
	eventTarget(node: ElementNode, target: { uid?: unknown }): ElementNode;
	/** Where element methods reach the main thread; null when no page runs. */
	setHost(host: RendererHost | null): void;
	/** The page heard a `layoutchange` on `target`, with `detail`: a late listener gets it. */
	sawLayout(target: unknown, detail: unknown): void;
	/**
	 * The page is gone: its root is no longer Lynx's page element, and keeps none of its listeners or
	 * of what was left under it.
	 */
	retire(): void;
	/** An element's tag by its id, for the text of an error. */
	tagOf(id: number): string | undefined;
	/**
	 * Writes the ops of the whole page again, from the tree as it is now, each element with the id
	 * it has: the main thread makes the page again from them.
	 */
	writePage(): void;
	/**
	 * Writes the ops of a list cell of the page again, the same way: its element, what is in it, and
	 * no insert into its list, which knows the cell. False, with nothing written, when `id` is not
	 * such a cell now.
	 */
	writeCell(id: number): boolean;
}

/** What the renderer writes into and keeps. */
export interface RendererState {
	queue: OpQueue;
	handlers: HandlerRegistry;
}

/** The event slot of a `layoutchange` listener. */
const LAYOUT_SLOT = "bindEvent:layoutchange";

/** The attribute that takes a gesture. */
const GESTURE_ATTRIBUTE = `${MAIN_THREAD_PREFIX}gesture`;

/** What a value is, as a message says it. */
function kindOf(value: unknown): string {
	if (isFunction(value)) return "a function";
	if (Array.isArray(value)) return "a list";
	if (typeof value === "object") return "an object";
	return `the ${typeof value} ${textOf(value)}`;
}

/** Makes the renderer, writing its ops into `queue` and its handlers into `handlers`. */
export function createLynxRenderer({ queue, handlers }: RendererState): LynxRenderer {
	let nextId = ROOT_ID + 1;
	let host: RendererHost | null = null;
	/** The root while a page runs. */
	let root: ElementNode | undefined;
	const elementsById = new Map<number, ElementNode>();
	const uids = new WeakMap<TreeNode, number>();
	const Element = elementClass({
		handlers,
		uids,
		root: () => root,
		setAttribute: (element, key, value) => setAttribute(element, key, value),
		setEvent: (element, change) => setEvent(element, change),
		setStyles(element, styles) {
			for (const name of Object.keys(styles)) {
				const value = styles[name];
				if (value == null || value === "") element.codeStyles?.delete(name);
				else (element.codeStyles ??= new Map()).set(name, value);
			}
			if (element.lynxId !== 0) queue.push([OpCode.SetStyles, element.lynxId, styles]);
		},
		animate(element, args) {
			if (element.lynxId !== 0) queue.push([OpCode.Animate, element.lynxId, args]);
		},
		host: () => host,
		nodeById: (id) => elementsById.get(id),
	});
	const pageRoot = new Element("page");
	const answerLateLayout = lateLayouts({
		host: () => host,
		sent: () => queue.sent,
		listening: (node, handler) => {
			const id = node.events?.get(LAYOUT_SLOT);
			return id !== undefined && handlers.has(id, handler);
		},
		later: (callback) => background.lynx.queueMicrotask(callback),
	});

	/** The cell of a node whose Lynx parent is `container`: a child of a page's list is a cell. */
	function cellUnder(container: TreeNode, node: TreeNode): number {
		return container.tag === "list" && container.cell === 0 ? node.lynxId : container.cell;
	}

	/** Binds the events a node collected, on its Lynx element. */
	function pushEvents(node: TreeNode): void {
		node.events?.forEach((id, slot) => {
			const colon = slot.indexOf(":");
			// Boundary: a slot's key is written by `setEvent` from a Lynx event type.
			const type = slot.slice(0, colon) as LynxEventType;
			queue.push([OpCode.SetEvent, node.lynxId, type, slot.slice(colon + 1), id]);
		});
	}

	/**
	 * Gives `node`'s subtree Lynx elements, now that it is attached under `container`: the create,
	 * the attributes and handlers it collected, and its children joined in. The caller inserts
	 * `node` itself. `again` writes the subtree again, each element with the id it has.
	 */
	function realize(node: TreeNode, container: TreeNode, again = false): void {
		if (node.kind === "text") {
			realizeText(node, container, again);
			return;
		}
		if (node.kind === "comment") return;
		if (node.kind === "fragment") {
			for (let child = node.first; child; child = child.next) realize(child, container, again);
			return;
		}
		if (node.lynxId !== 0 && !again) return;
		if (node.lynxId === 0) node.lynxId = nextId++;
		node.madeAt = queue.sent;
		node.cell = cellUnder(container, node);
		// A deferred row waits to be asked for only as a cell of a list of the page.
		if (node.tag === "list-item" && (container.tag !== "list" || container.cell !== 0))
			rowOf(node)?.show();
		node.layout = null;
		// Boundary: every element node is made by `createElement`, from the element class.
		elementsById.set(node.lynxId, node as ElementNode);
		const id = node.lynxId;
		queue.push([OpCode.Create, id, node.tag!]);
		// `forEach`, here and below: a `for…of` over a map's entries makes an array for each, which
		// Lynx's engine pays for on every element of the page.
		node.attrs?.forEach((value, key) => {
			if (!isFunction(value)) queue.push([OpCode.SetAttr, id, key, attrValue(key, value)]);
		});
		// Written again, an input starts from what it holds now.
		if (again && node.input)
			queue.push([OpCode.SetAttr, node.lynxId, "default-value", node.input.current]);
		if (node.codeStyles?.size)
			queue.push([OpCode.SetStyles, node.lynxId, Object.fromEntries(node.codeStyles)]);
		pushEvents(node);
		for (let child = node.first; child; child = child.next) {
			realize(child, node, again);
			if (child.lynxId !== 0) queue.push([OpCode.Insert, id, child.lynxId, 0]);
			else for (const real of topReals(child)) queue.push([OpCode.Insert, id, real.lynxId, 0]);
		}
	}

	function realizeText(node: TreeNode, container: TreeNode, again: boolean): void {
		if (node.lynxId !== 0 && !again) return;
		const parent = node.parent;
		if (parent?.kind === "element" && TEXT_CONTAINERS.has(parent.tag!)) {
			if (node.lynxId === 0) node.lynxId = nextId++;
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
		node.layout = null;
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

	/**
	 * Forgets a subtree of a page that is gone: its handlers and its elements' ids, with no op, since
	 * no page shows them.
	 */
	function forget(node: TreeNode): void {
		for (let child = node.first; child; child = child.next) forget(child);
		if (node.events) for (const id of node.events.values()) handlers.release(id);
		node.events = null;
		if (node.lynxId !== 0) elementsById.delete(node.lynxId);
		node.lynxId = 0;
		node.layout = null;
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
			node.layout = null;
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
			if (key === LAYOUT_SLOT) answerLateLayout(element, handler);
			return;
		}
		if (id === undefined || !handlers.remove(id, handler)) return;
		handlers.release(id);
		element.events.delete(key);
		// With no listener, Lynx sends no layout: the one heard last may go stale.
		if (key === LAYOUT_SLOT) element.layout = null;
		if (element.lynxId !== 0) queue.push([OpCode.SetEvent, element.lynxId, type, name, 0]);
	}

	const inputHost: InputHost = {
		listen: (element, name, handler) =>
			setEvent(element, { type: "bindEvent", name, handler, add: true }),
		setAttribute: (element, key, value) => setAttribute(element, key, value),
		setValue(element, params, answers) {
			if (!host || element.lynxId === 0)
				return Promise.reject(new Error(`<${element.tag}> is not on the page.`));
			return host.call(
				element.lynxId,
				answers === undefined
					? ["invoke", "setValue", params]
					: ["invoke", "setValue", params, answers],
			);
		},
	};

	/**
	 * In a development build, the mistakes a `main-thread:` attribute can hold: a value that is no
	 * gesture under `main-thread:gesture`, a plain function elsewhere, which binds nothing, and
	 * Lynx's own spelling of an event, which a spread lets through.
	 */
	function checkMainThreadAttribute(element: TreeNode, key: string, value: unknown): void {
		const where = sourceLocation(element);
		const tag = element.tag ?? "element";
		if (key === GESTURE_ATTRIBUTE) {
			// `false` turns a gesture off, as `undefined` does: `main-thread:gesture={on && pan}`.
			if (value !== false && !isGesture(value))
				reportOnce(`main_thread_gesture_not_a_gesture:${where ?? tag}`, () =>
					backgroundError({
						code: "main_thread_gesture_not_a_gesture",
						details: { value: kindOf(value), tag, where },
					}),
				);
			return;
		}
		if (isFunction(value))
			reportOnce(`plain_function_under_main_thread:${where ?? tag}:${key}`, () =>
				backgroundError({
					code: "plain_function_under_main_thread",
					details: { name: key, tag, where },
				}),
			);
		const removed = removedEventSpelling(key);
		if (removed?.replacement !== undefined) {
			const replacement = removed.replacement;
			reportOnce(`main_thread_event_spelling_removed:${where ?? tag}:${key}`, () =>
				backgroundError({
					code: "main_thread_event_spelling_removed",
					details: { name: key, replacement, tag, where },
				}),
			);
		}
	}

	function setAttribute(element: TreeNode, key: string, value: unknown): void {
		if (key === DEFERRED_ROW) {
			linkRow(element, value);
			return;
		}
		// The row's state reads `defer` where it is written; Lynx has no such attribute.
		if (key === DEFER && element.tag === "list-item") return;
		if (key === "value" && (element.tag === "input" || element.tag === "textarea")) {
			setInputValue(inputHost, element, value);
			return;
		}
		if (value == null) {
			if (!element.attrs?.delete(key)) return;
			if (element.lynxId !== 0) queue.push([OpCode.SetAttr, element.lynxId, key, null]);
			return;
		}
		if (DEV && key.startsWith(MAIN_THREAD_PREFIX)) checkMainThreadAttribute(element, key, value);
		const stored = key === "item-key" ? itemKey(element, value) : value;
		element.attrs ??= new Map();
		element.attrs.set(key, stored);
		if (element.lynxId !== 0 && !isFunction(stored))
			queue.push([OpCode.SetAttr, element.lynxId, key, attrValue(key, stored)]);
	}

	return {
		root: pageRoot,
		attachRoot() {
			pageRoot.lynxId = ROOT_ID;
			elementsById.set(ROOT_ID, pageRoot);
			root = pageRoot;
			pushEvents(pageRoot);
			return pageRoot;
		},
		nodeById: (id) => elementsById.get(id),
		eventTarget(node, target) {
			if (typeof target.uid === "number") uids.set(node, target.uid);
			return node;
		},
		setHost(next) {
			host = next;
		},
		sawLayout(target, detail) {
			if (target instanceof Element && isRecord(detail)) target.layout = detail;
		},
		retire() {
			host = null;
			if (!root) return;
			// What the page left under the root, such as the anchor it was mounted at.
			while (root.first) {
				const child = root.first;
				unlink(child);
				forget(child);
			}
			forget(root);
			root = undefined;
		},
		tagOf: (id) => elementsById.get(id)?.tag ?? undefined,
		writePage() {
			if (!root) return;
			pushEvents(root);
			for (let child = root.first; child; child = child.next) {
				realize(child, root, true);
				for (const real of topReals(child)) queue.push([OpCode.Insert, ROOT_ID, real.lynxId, 0]);
			}
		},
		writeCell(id) {
			const node = elementsById.get(id);
			const container = node && realContainer(node.parent);
			if (!node || !container || cellUnder(container, node) !== id) return false;
			realize(node, container, true);
			return true;
		},

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
		addEventListener: svelteListener({ Element, setEvent, add: true }),
		removeEventListener: svelteListener({ Element, setEvent, add: false }),
	};
}
