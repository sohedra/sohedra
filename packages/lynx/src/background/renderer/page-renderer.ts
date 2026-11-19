// The page's renderer, its op queue and its handlers. One Lynx bundle is one page, so each is one
// value: the renderer fills the queue and the handlers, and the page (../page.ts) drains them.

import type { SentEvent, SentTarget } from "../../wire/index.ts";
import { HandlerRegistry } from "./handlers.ts";
import { OpQueue } from "./queue.ts";
import { createLynxRenderer } from "./renderer.ts";
import type { LynxRenderer } from "./renderer.ts";

/** The ops of the page, which the channel sends. */
export const pageQueue: OpQueue = new OpQueue();

/** The handlers of the page's events. */
export const pageHandlers: HandlerRegistry = new HandlerRegistry();

/** The renderer every compiled component of the page uses. */
export const pageRenderer: LynxRenderer = createLynxRenderer({
	queue: pageQueue,
	handlers: pageHandlers,
});

/** An event's targets as the element nodes themselves; a target with no node stays as it came. */
export function withNodes(event: SentEvent): Record<string, unknown> {
	const node = (sent: SentTarget | undefined): unknown => {
		if (!sent) return sent;
		const found = sent.node === 0 ? undefined : pageRenderer.nodeById(sent.node);
		return found ? pageRenderer.eventTarget(found, sent) : sent;
	};
	return { ...event, target: node(event.target), currentTarget: node(event.currentTarget) };
}
