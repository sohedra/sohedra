// A renderer with its own queue and handlers, for tests of one module at a time.

import { HandlerRegistry } from "../../../src/background/renderer/handlers.ts";
import { OpQueue } from "../../../src/background/renderer/queue.ts";
import { createLynxRenderer } from "../../../src/background/renderer/renderer.ts";
import type { ElementNode, LynxRenderer } from "../../../src/background/renderer/renderer.ts";
import type { Op } from "../../../src/wire/index.ts";

export interface RendererFixture {
	renderer: LynxRenderer;
	handlers: HandlerRegistry;
	root: ElementNode;
	/** Makes an element and puts it under `parent` (the root by default). */
	element(tag: string, parent?: object): ElementNode;
	/** The ops since the last call. */
	ops(): Op[];
}

/** A renderer whose root is on the page, with no op taken yet. */
export function rendererFixture(): RendererFixture {
	const queue = new OpQueue();
	const handlers = new HandlerRegistry();
	const renderer = createLynxRenderer({ queue, handlers });
	const root = renderer.createRoot();
	return {
		renderer,
		handlers,
		root,
		element(tag, parent = root) {
			// Boundary: every element node is an ElementNode.
			const made = renderer.createElement(tag) as ElementNode;
			renderer.insert(parent as ElementNode, made, null);
			return made;
		},
		ops: () => queue.take(),
	};
}
