// What the renderer reaches beyond its tree, while a page runs: the main thread, through the page's
// channel, and the page's way of running a handler.

import type { CallRequest } from "../../wire/index.ts";
import type { Handler } from "./handlers.ts";

/** Where the renderer reaches the main thread and runs handlers: the page. */
export interface PageLink {
	/** Asks the main thread something about an element, after the ops made before; resolves with the answer. */
	call(element: number, request: CallRequest): Promise<unknown>;
	/** Runs `handler` with `event` as the page runs an event's handlers, Svelte's updates sent after. */
	run(handler: Handler, event: unknown): void;
}
