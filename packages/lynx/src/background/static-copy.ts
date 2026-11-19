// `createStaticCopy`: a lifeless copy of drawn elements, made from the background's own tree with
// the renderer's methods. Nothing is kept per element, and a page that does not import it carries
// none of it. Svelte never looks inside the container it puts copies in (it walks a container's
// own children only), so the copies are the app's.

import { MAIN_THREAD_PREFIX } from "../wire/index.ts";
import { backgroundError } from "./catalogue.ts";
import type { ElementNode } from "./renderer/element.ts";
import { TreeNode } from "./renderer/node.ts";
import { pageRenderer } from "./renderer/page-renderer.ts";

/** The options of `createStaticCopy`. */
export interface StaticCopyOptions {
	/**
	 * Keep each element's `id` in the copy. Left out, the copy has none: two elements with one id
	 * make `querySelector("#x")` and Lynx's own look-ups by id ambiguous.
	 * @defaultValue false
	 */
	keepIds?: boolean;
}

/** What `createStaticCopy` returns. */
export interface StaticCopy {
	/** The copies' roots, in the order of the sources: nodes of the page. */
	readonly nodes: readonly ElementNode[];
	/**
	 * Takes this call's copies out of the container. It does nothing the second time, or once Svelte
	 * removed the container, which took the copies with it.
	 */
	remove(): void;
}

/** The roots of the copies still in a container: all a container may hold. */
let copies: WeakSet<TreeNode> | undefined;

/** An element node of the page that has a Lynx element now. */
const isOnPage = (value: unknown): value is ElementNode =>
	value instanceof TreeNode &&
	value.kind === "element" &&
	value.lynxId !== 0 &&
	pageRenderer.nodeById(value.lynxId) === value;

function holdsList(node: TreeNode): boolean {
	if (node.tag === "list") return true;
	for (let child = node.first; child; child = child.next)
		if (child.kind === "element" && holdsList(child)) return true;
	return false;
}

/**
 * An attribute's value as a copy gets it: arrays and plain objects copied all the way down, so the
 * copy's are its own.
 */
function copyValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(copyValue);
	if (typeof value !== "object" || value === null) return value;
	const prototype: unknown = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return value;
	const copied: Record<string, unknown> = {};
	for (const key of Object.keys(value))
		copied[key] = copyValue((value as Record<string, unknown>)[key]);
	return copied;
}

/** A node of the page as a detached copy: no `id` unless kept, no listener, no main-thread attribute. */
function copyElement(node: TreeNode, keepIds: boolean): ElementNode {
	// Boundary: the renderer's elements are element nodes.
	const made = pageRenderer.createElement(node.tag!) as ElementNode;
	node.attrs?.forEach((value, key) => {
		// A function is a listener; a `main-thread:` value is a main-thread function, gesture or ref.
		if (typeof value === "function" || key.startsWith(MAIN_THREAD_PREFIX)) return;
		if (key === "id" && !keepIds) return;
		(made.attrs ??= new Map()).set(key, copyValue(value));
	});
	for (let child = node.first; child; child = child.next) {
		// Elements and the text the page shows; a comment is Svelte's anchor, and text outside a
		// `<text>` (spaces between views) never had an element.
		if (child.kind === "element") pageRenderer.insert(made, copyElement(child, keepIds), null);
		else if (child.kind === "text" && child.lynxId !== 0)
			pageRenderer.insert(made, pageRenderer.createTextNode(child.data ?? ""), null);
	}
	return made;
}

/**
 * Copies drawn elements, with everything under them, into an element: a lifeless copy that keeps
 * outgoing content on screen, or a hidden twin to measure. The copies are nodes of the page:
 * `invoke`, `setAttribute`, `setStyleProperty`, `contains` and `isConnected` work on them as on
 * any node, and a call and the changes made to its copies in the same tick reach the screen
 * together.
 *
 * ```ts
 * import { createStaticCopy } from "@sohedra/lynx";
 *
 * const copy = createStaticCopy(card, holder);
 * copy.nodes; // the copies' roots
 * copy.remove(); // takes this call's copies out
 * ```
 *
 * `source` is one node or a list of them; `container` is an element Svelte rendered with no
 * children. A container that holds copies takes more after them, and each call's `remove()` takes
 * out its own. If Svelte removes the container, the copies go with it.
 *
 * A copy carries each element's tag, its text and its attributes as they are at the call, object
 * values copied. It leaves out listeners, `main-thread:` attributes and `id` unless `keepIds`. It
 * cannot carry what the background does not hold: styles set with `setStyleProperty` (set them
 * on the copy), a scroll position, typed text, an animation's progress, what a main-thread
 * function set. A `<list>` cannot be copied.
 *
 * Throws, before any node is made, when the container is not an element on the page or holds
 * something that is not a copy, when a source is not an element on the page, and when a source
 * holds a `<list>`. On the main thread it throws too: call it from an effect, an attachment or an
 * event handler.
 */
export function createStaticCopy(
	source: ElementNode | readonly ElementNode[],
	container: ElementNode,
	options: StaticCopyOptions = {},
): StaticCopy {
	if (!isOnPage(container))
		throw backgroundError({ code: "static_copy_not_on_page", details: { what: "container" } });
	const held = (copies ??= new WeakSet());
	for (let child = container.first; child; child = child.next)
		if (!held.has(child))
			throw backgroundError({
				code: "static_copy_container_not_empty",
				details: { tag: container.tag ?? "" },
			});
	const list = Array.isArray(source);
	const sources: readonly unknown[] = list ? source : [source];
	sources.forEach((node, index) => {
		if (!isOnPage(node))
			throw backgroundError({
				code: "static_copy_not_on_page",
				details: { what: list ? `source[${index}]` : "source" },
			});
	});
	const nodes = sources as readonly ElementNode[];
	if (nodes.some(holdsList)) throw backgroundError({ code: "static_copy_list", details: {} });

	const keepIds = options.keepIds === true;
	// Made apart from the page, then put in: the container gets every copy in one go.
	const roots = nodes.map((node) => copyElement(node, keepIds));
	for (const made of roots) {
		held.add(made);
		pageRenderer.insert(container, made, null);
	}
	let removed = false;
	return {
		nodes: roots,
		remove() {
			if (removed) return;
			removed = true;
			for (const made of roots) {
				held.delete(made);
				// A copy Svelte took away with its container has no Lynx element left.
				if (made.lynxId !== 0) pageRenderer.remove(made);
			}
		},
	};
}
