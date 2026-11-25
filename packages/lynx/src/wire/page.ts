// What every message between the threads carries: the version of the format it is written in, and
// the generation of the page its content belongs to.
//
// The generation is a number that tells one life of a page from the next. It starts at 0, and each
// thread bumps it when the page reloads and when it is destroyed. The rules, which every sender and
// receiver follows:
//
// - A message is stamped with the generation its content belongs to, not the sender's generation
//   now: a reply with its call's, a release with its contexts', an error with the one it was thrown
//   in. A reply item rides only in a patch of its call's generation; a reply to an earlier
//   generation's call is dropped by the side that answers.
// - The main thread bumps when the engine updates the page with a reloaded template and when the
//   page is destroyed, and starts the page over at its bump: it drops every element of the old
//   generation and its table of ids, so nothing of the new one names them.
// - The background bumps synchronously, first thing when the app reloads and when its page is
//   destroyed, before any teardown and any `await`. Its teardown of the old generation sends
//   nothing, or sends it stamped with the old generation.
// - A receiver keeps a message of its own generation and drops any other, except an error, which
//   runs no handler and only reports.
//
// The engine posts a reload to the background before it reloads the main thread, in one task, so
// the main thread bumps first, and what it sends after its bump reaches the background after the
// reload does. A message of a later generation than its receiver's therefore means the page
// reloaded on one thread only, which a development build reports.

import { wireDevelopmentError } from "./development-catalogue.ts";
import type { Thread } from "./names.ts";

/** The version of the format. A change that a thread of an older build would misread bumps it. */
export const PROTOCOL_VERSION = 4;

/** The stamp on every message. */
export interface Stamp {
	/** The version of the format it is written in. */
	v: number;
	/** The generation of the page its content belongs to. */
	generation: number;
}

/** A message as a receiver checks it: its stamp, and its kind when it is a message to the background. */
type Stamped = Stamp & { t?: string };

/**
 * Whether a receiver keeps a message: one of the generation it shows now. Every receiver asks this of
 * every message, and drops what it does not keep. An error of another generation was reported into
 * Lynx where it was thrown, and the page's `onError` does not hear it: that generation is gone.
 */
export function keepsMessage(message: Stamped, generation: number): boolean {
	return message.generation === generation;
}

/** The thread that received a message, and the generation of the page it shows. */
interface Receiver {
	thread: Thread;
	generation: number;
}

/**
 * Throws when a message is written in another version of the format (the threads came from
 * different builds), or belongs to a later generation than its receiver's (the page reloaded on one
 * thread only). A receiver calls it in development builds, before `keepsMessage`.
 */
export function checkMessage(message: Stamped, { thread, generation }: Receiver): void {
	if (message.v !== PROTOCOL_VERSION)
		throw wireDevelopmentError({
			code: "threads_from_different_builds",
			details: { thread, received: message.v, expected: PROTOCOL_VERSION },
		});
	if (message.generation > generation && message.t !== "error")
		throw wireDevelopmentError({
			code: "page_reloaded_on_one_thread",
			details: { thread, received: message.generation, generation },
		});
}
