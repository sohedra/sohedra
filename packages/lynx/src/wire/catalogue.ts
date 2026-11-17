// The wire's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/wire/catalogue.test.ts` fails for an entry without a fix or a page, and snapshots
// every message.

import { docsLink, formatMessage } from "./messages.ts";
import type { Catalogue } from "./messages.ts";
import type { Thread } from "./names.ts";

/** The details each of the wire's messages is written from. */
export interface WireDetails {
	threads_from_different_builds: { thread: Thread; received: number; expected: number };
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
