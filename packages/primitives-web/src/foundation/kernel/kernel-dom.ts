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
