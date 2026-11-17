// The element nodes a component sees, through an attachment, `use:` or an event's target: the
// tree questions of the DOM, their attributes and their listeners, answered from the renderer's
// tree, and the methods that reach the Lynx element on the main thread.

import { CSS_PROPS_HOLDERS } from "../../svelte/runtime/index.ts";
import { listenerEvent } from "../../wire/index.ts";
import type { LynxEventType } from "../../wire/index.ts";
import { startAnimation } from "./animation.ts";
import type { AnimationOptions, Keyframe, LynxAnimation } from "./animation.ts";
import type { Handler, HandlerRegistry } from "./handlers.ts";
import type { RendererHost } from "./host.ts";
import { elementMethods, notOnPage, pageGone } from "./methods.ts";
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
	/**
	 * The last child, as in the DOM. Svelte reads it on the element that holds a component's
	 * `--x` properties, before it is on the page: Lynx has no such element, so it becomes a `view`,
	 * which is a real box in the layout (Lynx has no `display: contents`).
	 */
	readonly lastChild: TreeNode | null;
	/**
	 * Calls Lynx's UI method `method` of the element (`boundingClientRect`, `scrollTo`…) and
	 * resolves with its answer. Rejects with Lynx's code when the method fails.
	 */
	invoke(method: string, params?: Record<string, unknown>): Promise<unknown>;
	/** Sets one inline style from code; `null` or `""` gives the property back to `style`. */
	setStyleProperty(name: string, value: string | number | null): void;
	/** Sets inline styles from code, as `setStyleProperty` does each. */
	setStyleProperties(styles: Record<string, string | number | null>): void;
	/** The value Lynx computed for one of the element's styles. */
	getComputedStyleProperty(name: string): Promise<string>;
	/** The first element under this one that `selector` matches, or `null`. */
	querySelector(selector: string): Promise<ElementNode | null>;
	/** Every element under this one that `selector` matches. */
	querySelectorAll(selector: string): Promise<ElementNode[]>;
	/** Animates the element; a number is the duration in milliseconds. */
	animate(keyframes: Keyframe[], options?: number | AnimationOptions): LynxAnimation<ElementNode>;
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
	/** Sets inline styles from code: sent now, or kept until the node's Lynx element is made. */
	setStyles(element: TreeNode, styles: Record<string, string | number | null>): void;
	/** Sends `__ElementAnimate`'s arguments to the node's Lynx element, if it has one. */
	animate(element: TreeNode, args: unknown[]): void;
	/** The page's host; null when no page runs. */
	host(): RendererHost | null;
	/** The element node with this id, while it is on the page. */
	nodeById(id: number): ElementNode | undefined;
}

/** The class of a renderer's element nodes. */
export type ElementClass = new (tag: string) => ElementNode;

/** The class of the element nodes of one renderer: its methods reach that renderer's tree. */
export function elementClass(scope: ElementScope): ElementClass {
	const methods = elementMethods<ElementNode>(scope);

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

		get lastChild(): TreeNode | null {
			// Only here, before the node has a Lynx element: no other element pays for it.
			if (this.lynxId === 0 && CSS_PROPS_HOLDERS.has(this.tag!)) this.tag = "view";
			return this.last;
		}

		invoke(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
			return methods.invoke(this, { method, params });
		}

		setStyleProperty(name: string, value: string | number | null): void {
			scope.setStyles(this, { [name]: value });
		}

		setStyleProperties(styles: Record<string, string | number | null>): void {
			scope.setStyles(this, styles);
		}

		getComputedStyleProperty(name: string): Promise<string> {
			return methods.computedStyle(this, name);
		}

		querySelector(selector: string): Promise<ElementNode | null> {
			return methods.querySelector(this, selector);
		}

		querySelectorAll(selector: string): Promise<ElementNode[]> {
			return methods.querySelectorAll(this, selector);
		}

		animate(
			keyframes: Keyframe[],
			options: number | AnimationOptions = {},
		): LynxAnimation<ElementNode> {
			const host = scope.host();
			if (host && this.lynxId === 0) throw notOnPage(this, "animate");
			return startAnimation<ElementNode>({
				node: this,
				tag: this.tag ?? "",
				keyframes,
				options: typeof options === "number" ? { duration: options } : options,
				send: host ? (args) => scope.animate(this, args) : undefined,
				gone: () => pageGone("animate"),
				listen: (type, handler) => this.addEventListener(type, handler),
				unlisten: (type, handler) => this.removeEventListener(type, handler),
			});
		}
	}

	return Element;
}

/** What `svelteListener` adds or removes listeners with. */
export interface ListenerOptions {
	Element: ElementClass;
	setEvent(element: TreeNode, change: ListenerChange): void;
	add: boolean;
}

/**
 * The renderer's `addEventListener` (or, with `add` false, `removeEventListener`), where Svelte's
 * `on()` goes: a node listens through its event slots; any other target, such as a media query
 * list, keeps its own listeners.
 */
export function svelteListener({
	Element,
	setEvent,
	add,
}: ListenerOptions): (
	target: TreeNode,
	type: string,
	handler: Handler,
	options?: { capture?: boolean },
) => void {
	return (target, type, handler, options) => {
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
