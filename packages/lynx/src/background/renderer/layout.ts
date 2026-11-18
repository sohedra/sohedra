// A `layoutchange` listener added to an element that already has a layout. Lynx sends the event
// when an element's frame is set and it listens for the event then (LynxUI.m,
// sendLayoutChangeEvent; LynxBaseUI.java): a listener added later hears nothing until the
// element's layout changes. So, as `ResizeObserver` does on `observe`, such a listener gets the
// current layout once: the last one the page heard for the element, or, when it heard none, the
// element's `boundingClientRect`.

import type { Handler } from "./handlers.ts";
import type { RendererHost } from "./host.ts";
import type { TreeNode } from "./node.ts";
import { isRecord } from "./values.ts";

/** What answering a late listener needs of the renderer. */
export interface LayoutScope {
	host(): RendererHost | null;
	/** How many patches the page has sent. */
	sent(): number;
	/** Whether `handler` still listens for `layoutchange` on `node`. */
	listening(node: TreeNode, handler: Handler): boolean;
	/** Runs `callback` on a microtask. */
	later(callback: () => void): void;
}

/** The event a late listener gets: Lynx's `layoutchange`, with the layout as its detail. */
function layoutEvent(node: TreeNode, layout: Record<string, unknown>): Record<string, unknown> {
	return { type: "layoutchange", detail: layout, target: node, currentTarget: node };
}

/**
 * Makes the function that answers a `layoutchange` listener just added to `node`.
 *
 * @workaround late-layoutchange-listener kind=lynx-gap delete-when="Lynx sends the current layout to a layoutchange listener added after the element was laid out"
 */
export function lateLayouts(scope: LayoutScope): (node: TreeNode, handler: Handler) => void {
	return (node, handler) => {
		const host = scope.host();
		// An element made in a patch not sent yet has its first layout to come, with the listener.
		if (!host || node.lynxId === 0 || node.madeAt >= scope.sent()) return;
		const answer = (layout: Record<string, unknown>): void => {
			if (scope.listening(node, handler)) host.run(handler, layoutEvent(node, layout));
		};
		const known = node.layout;
		if (known) {
			scope.later(() => answer(known));
			return;
		}
		host.call(node.lynxId, ["invoke", "boundingClientRect", {}]).then(
			(rect) => {
				// A layoutchange that came first was heard by the listener already.
				if (node.layout || !isRecord(rect)) return;
				node.layout = rect;
				answer(rect);
			},
			// No layout to give: the element is in a list row Lynx is not showing, or the page is gone.
			() => {},
		);
	};
}
