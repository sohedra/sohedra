// Names DOM types, as thread code must not: the DOM-type check finds both.

export function first(node: Node): Element | null {
	return node.parentElement;
}
