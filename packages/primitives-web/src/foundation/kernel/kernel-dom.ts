// DOM queries every web part may need: a node's document and window, its kind and its parents.
/** The node's document, or the global one. */
export function ownerDocument(node: Node | null | undefined): Document {
	return node?.ownerDocument || document;
}

/** The window of the node's document, or the global one. */
export function ownerWindow(node: Node | null | undefined): Window & typeof globalThis {
	return (ownerDocument(node).defaultView || window) as Window & typeof globalThis;
}

/** Whether `value` is an HTML element of its own window (an iframe's too). */
export function isHTMLElement(value: unknown): value is HTMLElement {
	if (typeof Node === "undefined" || !(value instanceof ownerWindow(value as Node).Node)) {
		return value instanceof HTMLElement;
	}
	return value instanceof ownerWindow(value as Node).HTMLElement;
}

/** The node's lowercase name; `#document` for a window. */
export function getNodeName(node: Node | Window): string {
	return isNode(node) ? (node.nodeName || "").toLowerCase() : "#document";
}

function isNode(value: unknown): value is Node {
	return typeof Node !== "undefined" && value instanceof Node;
}

/** Whether `value` is an element node. */
export function isElement(value: unknown): value is Element {
	return value != null && (value as Node).nodeType === 1;
}

/** Whether `value` is a shadow root. */
export function isShadowRoot(value: unknown): value is ShadowRoot {
	return value != null && (value as Node).nodeType === 11 && "host" in (value as ShadowRoot);
}

/** The element's computed style, from its own window. */
export function getComputedStyle(element: Element): CSSStyleDeclaration {
	return ownerWindow(element).getComputedStyle(element);
}

/** Whether a walk up the tree ends at the node (`html`, `body` or the document). */
export function isLastTraversableNode(node: Node): boolean {
	return ["html", "body", "#document"].includes(getNodeName(node));
}

/** The parent across slots and shadow roots (Floating UI's `getParentNode`). */
export function getParentNode(node: Node): Node {
	if (getNodeName(node) === "html") {
		return node;
	}
	return (
		(node as Element).assignedSlot ||
		node.parentNode ||
		(isShadowRoot(node) && node.host) ||
		(node.ownerDocument ?? document).documentElement
	);
}

/** Whether the element clips or scrolls its content. */
export function isOverflowElement(element: Element): boolean {
	const { overflow, overflowX, overflowY, display } = getComputedStyle(element);
	return (
		/auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) &&
		display !== "inline" &&
		display !== "contents"
	);
}
