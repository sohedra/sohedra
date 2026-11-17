// The wire's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/wire/catalogue.test.ts` fails for an entry without a fix or a page, and snapshots
// every message.

import { docsLink, formatMessage } from "./messages.ts";
import type { Catalogue } from "./messages.ts";
import type { Thread } from "./names.ts";

/** The details each of the wire's messages is written from. */
export interface WireDetails {
	threads_from_different_builds: { thread: Thread; received: number; expected: number };
	page_reloaded_on_one_thread: { thread: Thread; received: number; page: number };
	/** `thread` is the thread the value was sent to. */
	value_not_copyable: { thread: Thread; reason: string };
	/** `change` is what the main thread was doing, in development builds (`describeOp`). */
	change_not_applied: { reason: string; change?: string | undefined };
}

/** What a code of the wire names. */
export type WireCode = keyof WireDetails;

const THREAD_NAMES: Record<Thread, string> = {
	background: "the background",
	"main-thread": "the main thread",
};

/** Every message of the wire. */
export const WIRE_CATALOGUE: Catalogue<WireDetails> = {
	threads_from_different_builds: {
		message: ({ thread, received, expected }) =>
			"This page's main thread and background thread come from different builds of the app.\n" +
			`Seen on ${THREAD_NAMES[thread]}: it reads version ${expected} of what the threads send each other, and got version ${received}.`,
		fix: () =>
			"Build the app again and reopen the page, so both threads load from one build. If the host caches bundles, clear its cache.",
		docs: "threads_from_different_builds",
	},
	page_reloaded_on_one_thread: {
		message: ({ thread, received, page }) =>
			"This page reloaded on one of its threads only.\n" +
			`Seen on ${THREAD_NAMES[thread]}: it shows page ${page} and got a message of page ${received}.`,
		fix: () =>
			"Reload the page through Lynx, with `lynx.reload()` or the host's reload, so both threads start the new page together.",
		docs: "page_reloaded_on_one_thread",
	},
	value_not_copyable: {
		message: ({ thread, reason }) =>
			`A value sent to ${THREAD_NAMES[thread]} cannot be copied (${reason.split("\n")[0]!.trim()}).`,
		fix: () =>
			"Send plain data: strings, numbers, booleans, null, arrays and plain objects, without cycles or BigInt values.",
		docs: "value_not_copyable",
	},
	change_not_applied: {
		message: ({ reason, change }) =>
			`Lynx refused a change to the page on the main thread: ${reason.split("\n")[0]!.trim()}` +
			(change === undefined ? "" : `\nWhile trying to ${change}.`),
		fix: () =>
			"The rest of the change was applied. This is a bug in @sohedra/lynx or in Lynx: report it with the component and the steps that lead to it.",
		docs: "change_not_applied",
	},
};

/** One message of the wire: its code and the details it is written from. */
export interface WireReport<Code extends WireCode> {
	code: Code;
	details: WireDetails[Code];
}

/** The text of a message of the wire. */
export function wireMessage<Code extends WireCode>({ code, details }: WireReport<Code>): string {
	const entry = WIRE_CATALOGUE[code];
	return formatMessage({
		sentence: entry.message(details),
		fix: entry.fix(details),
		link: docsLink(entry.docs),
	});
}

/** An error of the wire: its text is the message, and `code` the message's stable code. */
export type WireError = Error & { code: WireCode };

/** The error for a message of the wire. */
export function wireError<Code extends WireCode>(report: WireReport<Code>): WireError {
	return Object.assign(new Error(wireMessage(report)), { code: report.code });
}
