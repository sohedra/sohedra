// The first frame's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/first-frame/catalogue.test.ts` fails for an entry without a fix or a page, and
// snapshots every message.

import { docsLink, formatMessage } from "../wire/index.ts";
import type { Catalogue } from "../wire/index.ts";

/** The details each of the first frame's messages is written from. */
export interface FirstFrameDetails {
	/** `component` is the page's root component. */
	first_frame_skipped_await: { component: string };
}

/** What a code of the first frame names. */
export type FirstFrameCode = keyof FirstFrameDetails;

/** Every message of the first frame. */
export const FIRST_FRAME_CATALOGUE: Catalogue<FirstFrameDetails> = {
	first_frame_skipped_await: {
		message: ({ component }) =>
			`The page ${component} has no first frame: a component in it (Svelte does not say which) awaits outside a <svelte:boundary> with a pending snippet, and the first frame is drawn without waiting.`,
		fix: () =>
			"Put the part that awaits in a <svelte:boundary> with a pending snippet: the first frame then shows the pending snippet, and the page shows the rest when it is ready.",
		docs: "first_frame_skipped_await",
	},
};

/** One message of the first frame: its code and the details it is written from. */
export interface FirstFrameReport<Code extends FirstFrameCode> {
	code: Code;
	details: FirstFrameDetails[Code];
}

/** The error for a message of the first frame: its text is the message, `code` its stable code. */
export function firstFrameError<Code extends FirstFrameCode>({
	code,
	details,
}: FirstFrameReport<Code>): Error & { code: Code } {
	const entry = FIRST_FRAME_CATALOGUE[code];
	const text = formatMessage({
		sentence: entry.message(details),
		fix: entry.fix(details),
		link: docsLink(entry.docs),
	});
	return Object.assign(new Error(text), { code });
}
