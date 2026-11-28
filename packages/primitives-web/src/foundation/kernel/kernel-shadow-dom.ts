function isShadowRoot(node: Node | null | undefined): node is ShadowRoot {
	return (
		!!node && node.nodeType === 11 /* DOCUMENT_FRAGMENT_NODE */ && "host" in (node as ShadowRoot)
	);
}

function isElement(node: Node | null | undefined): node is Element {
	return !!node && node.nodeType === 1; /* ELEMENT_NODE */
}

/**
 * Finds the closest matching element in the composed tree, crossing slots and shadow roots.
 * `:scope` is not supported.
 */
export function closest(node: Node | null | undefined, selector: string): Element | null {
	let current = node;
	while (current) {
		if (isElement(current) && current.matches(selector)) {
			return current;
		}
		current =
			(current as Element).assignedSlot ??
			current.parentNode ??
			(isShadowRoot(current) ? current.host : null);
	}
	return null;
}

/** The focused element, looking into open shadow roots. */
export function activeElement(doc: Document): Element | null {
	let element = doc.activeElement;
	while (element?.shadowRoot?.activeElement != null) {
		element = element.shadowRoot.activeElement;
	}
	return element;
}

/** Whether `parent` contains `child`, also across shadow roots. */
export function contains(parent?: Element | null, child?: Element | null): boolean {
	if (!parent || !child) {
		return false;
	}
	if (parent.contains(child)) {
		return true;
	}
	if (isShadowRoot(child.getRootNode?.())) {
		let next: Node | null = child;
		while (next) {
			if (parent === next) {
				return true;
			}
			next = next.parentNode || (next as unknown as ShadowRoot).host || null;
		}
	}
	return false;
}

/** The event's innermost target, across shadow roots (`target` once dispatch is over). */
export function getTarget(event: Event): EventTarget | null {
	return event.composedPath()[0] ?? event.target;
}
