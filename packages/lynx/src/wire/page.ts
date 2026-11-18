// What every message between the threads carries: the version of the format it is written in, and
// the page its content belongs to.
//
// The page is a generation: a number that starts at 0, and that each thread bumps when the page
// reloads and when it is destroyed. The rules, which every sender and receiver follows:
//
// - A message is stamped with the page its content belongs to, not the sender's page now: a reply
//   with its call's page, a release with its contexts' page, an error with the page it was thrown
//   in. A reply item rides only in a patch of its call's page; a reply to an earlier page's call
//   is dropped by the side that answers.
// - The main thread bumps when the engine updates the page with a reloaded template and when the
//   page is destroyed, and starts the page over at its bump: it drops every element of the old page
//   and its table of ids, so nothing of the new page names them.
// - The background bumps synchronously, first thing when the app reloads and when its page is
//   destroyed, before any teardown and any `await`. Its teardown of the old page sends nothing, or
//   sends it stamped with the old page.
// - A receiver keeps a message of its own page and drops any other, except an error, which runs no
//   handler and only reports.
//
// The engine posts a reload to the background before it reloads the main thread, in one task, so
// the main thread bumps first, and what it sends after its bump reaches the background after the
// reload does. A message of a later page than its receiver's therefore means the page reloaded on
// one thread only, which a development build reports.

import { wireError } from "./catalogue.ts";
import type { Thread } from "./names.ts";

/** The version of the format. A change that a thread of an older build would misread bumps it. */
export const PROTOCOL_VERSION = 2;

/** The stamp on every message. */
export interface Stamp {
	/** The version of the format it is written in. */
	v: number;
	/** The generation of the page its content belongs to. */
	page: number;
}

/** A message as a receiver checks it: its stamp, and its kind when it is a message to the background. */
export type Stamped = Stamp & { t?: string };

/**
 * Whether a receiver keeps a message: one of the page it shows now, or an error of any page. Every
 * receiver asks this of every message, and drops what it does not keep.
 */
export function keepsMessage(message: Stamped, page: number): boolean {
	return message.page === page || message.t === "error";
}

/** The thread that received a message, and the page it shows. */
export interface Receiver {
	thread: Thread;
	page: number;
}

/**
 * Throws when a message is written in another version of the format (the threads came from
 * different builds), or belongs to a later page than its receiver's (the page reloaded on one
 * thread only). A receiver calls it in development builds, before `keepsMessage`.
 */
export function checkMessage(message: Stamped, { thread, page }: Receiver): void {
	if (message.v !== PROTOCOL_VERSION)
		throw wireError({
			code: "threads_from_different_builds",
			details: { thread, received: message.v, expected: PROTOCOL_VERSION },
		});
	if (message.page > page && message.t !== "error")
		throw wireError({
			code: "page_reloaded_on_one_thread",
			details: { thread, received: message.page, page },
		});
}
