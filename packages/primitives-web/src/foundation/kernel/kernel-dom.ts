// DOM queries every web part may need: a node's document and window, its kind and its parents.
export function ownerDocument(node: Node | null | undefined): Document {
	return node?.ownerDocument || document;
}

export function ownerWindow(node: Node | null | undefined): Window & typeof globalThis {
	return (ownerDocument(node).defaultView || window) as Window & typeof globalThis;
}

export function isHTMLElement(value: unknown): value is HTMLElement {
	if (typeof Node === "undefined" || !(value instanceof ownerWindow(value as Node).Node)) {
		return value instanceof HTMLElement;
	}
	return value instanceof ownerWindow(value as Node).HTMLElement;
}

export function getNodeName(node: Node | Window): string {
	return isNode(node) ? (node.nodeName || "").toLowerCase() : "#document";
}

function isNode(value: unknown): value is Node {
	return typeof Node !== "undefined" && value instanceof Node;
}

export function isElement(value: unknown): value is Element {
	return value != null && (value as Node).nodeType === 1;
}

export function isShadowRoot(value: unknown): value is ShadowRoot {
	return value != null && (value as Node).nodeType === 11 && "host" in (value as ShadowRoot);
}

export function getComputedStyle(element: Element): CSSStyleDeclaration {
	return ownerWindow(element).getComputedStyle(element);
}

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

export function isOverflowElement(element: Element): boolean {
	const { overflow, overflowX, overflowY, display } = getComputedStyle(element);
	return (
		/auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) &&
		display !== "inline" &&
		display !== "contents"
	);
}
