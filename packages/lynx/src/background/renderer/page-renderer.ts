// The page's renderer, its op queue and its handlers. One Lynx bundle is one page, so each is one
// value: the renderer fills the queue and the handlers, and the page (../page.ts) drains them.

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
