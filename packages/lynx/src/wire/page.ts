// What every message between the threads carries: the version of the format it is written in, and
// the page it belongs to.
//
// The page is a generation, a number that starts at 0 and that each thread bumps when the page
// reloads and when it is destroyed: the main thread when the engine updates the page with a reloaded
// template and when it destroys the page, the background when the app reloads and when its page is
// destroyed. A message of another generation is the old page's, or reached a thread before it
// heard of the reload, and is dropped.

import { wireError } from "./catalogue.ts";
import type { Thread } from "./names.ts";

/** The version of the format. A change that a thread of an older build would misread bumps it. */
export const PROTOCOL_VERSION = 1;

/** The stamp on every message: the format's version and the page's generation. */
export interface Stamp {
	v: number;
	page: number;
}

/**
 * Whether a message belongs to the page a thread shows now. Every receiver asks this of every
 * message, and drops one of another generation.
 */
export function isCurrentPage(message: Stamp, page: number): boolean {
	return message.page === page;
}

/**
 * Throws when a message is written in another version of the format: the two threads came from
 * different builds. A receiver checks it in development builds.
 */
export function checkVersion(message: Stamp, thread: Thread): void {
	if (message.v === PROTOCOL_VERSION) return;
	throw wireError({
		code: "threads_from_different_builds",
		details: { thread, received: message.v, expected: PROTOCOL_VERSION },
	});
}
