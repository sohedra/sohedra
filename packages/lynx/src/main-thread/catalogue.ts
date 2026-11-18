// The main thread's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/main-thread/catalogue.test.ts` fails for an entry without a fix or a page, and
// snapshots every message.

import { docsLink, formatMessage } from "../wire/index.ts";
import type { Catalogue } from "../wire/index.ts";

const REPORT =
	"This is a bug in @sohedra/lynx: report it with the component and the steps that lead to it.";

/** The details each of the main thread's messages is written from. */
export interface MainThreadDetails {
	/** `change` is what the main thread was doing, in development builds (`describeOp`). */
	change_not_applied: { reason: string; change?: string | undefined };
	element_missing: { id: number };
	call_not_supported: { kind: string };
	ui_method_failed: { method: string; code: number };
	element_has_no_view: { method: string };
	element_left_page: { method: string };
	/** `at` is the index in the markup where it could not be read. */
	first_frame_markup_unreadable: { reason: string; at: number };
	/** `reason` is the first line of what the page's components threw. */
	first_frame_threw: { reason: string };
	rewrite_not_page: { id: number };
}

/** What a code of the main thread names. */
export type MainThreadCode = keyof MainThreadDetails;

/** Every message of the main thread. */
export const MAIN_THREAD_CATALOGUE: Catalogue<MainThreadDetails> = {
	change_not_applied: {
		message: ({ reason, change }) =>
			`A change to the page could not be applied on the main thread: ${reason.split("\n")[0]!.trim()}` +
			(change === undefined ? "" : `\nWhile trying to ${change}.`),
		fix: () => `The rest of the change was applied. ${REPORT}`,
		docs: "change_not_applied",
	},
	element_missing: {
		message: ({ id }) => `The main thread has no element ${id}.`,
		fix: () => `The two threads disagree about the page. ${REPORT}`,
		docs: "element_missing",
	},
	call_not_supported: {
		message: ({ kind }) => `The main thread cannot answer a call of ${kind} yet.`,
		fix: () => `The background asked for something this main thread does not know. ${REPORT}`,
		docs: "call_not_supported",
	},
	ui_method_failed: {
		message: ({ method, code }) =>
			`Lynx could not run ${method} on the element: it answered with the code ${code}.`,
		fix: ({ method }) =>
			`Check that the element is on the page, and that Lynx's docs list ${method} as a UI method of its tag.`,
		docs: "ui_method_failed",
	},
	element_has_no_view: {
		message: ({ method }) =>
			`Lynx could not run ${method}: the element has no view on the screen. Lynx makes a view only for an element it draws, not for one that is hidden or not shown yet.`,
		fix: ({ method }) =>
			`Call ${method} once the element is shown, for example after a layoutchange event of the element.`,
		docs: "element_has_no_view",
	},
	element_left_page: {
		message: ({ method }) =>
			`Lynx could not run ${method}: the element was removed from the page in the same update, before Lynx ran the call.`,
		fix: () =>
			"Call the method while the element is on the page, or check that it still is, for example in the attachment that keeps it.",
		docs: "element_left_page",
	},
	first_frame_markup_unreadable: {
		message: ({ reason, at }) =>
			`The first frame was not drawn: its markup could not be read at character ${at}, where ${reason}.`,
		fix: () => `The page is shown when the background has made it. ${REPORT}`,
		docs: "first_frame_markup_unreadable",
	},
	first_frame_threw: {
		message: ({ reason }) =>
			`The first frame was not drawn: a component threw as the page rendered it on the main thread (${reason.split("\n")[0]!.trim()}).`,
		fix: () =>
			"Keep code only the background can run, such as a native module or the background's lynx APIs, out of a component's top level: in an effect, an event handler, or in {#if background} from @sohedra/lynx/env. The page is shown when the background has made it.",
		docs: "first_frame_threw",
	},
	rewrite_not_page: {
		message: ({ id }) =>
			`The background wrote element ${id} again, and the main thread writes only the whole page again.`,
		fix: () => `The rest of the change was applied. ${REPORT}`,
		docs: "rewrite_not_page",
	},
};

/** One message of the main thread: its code and the details it is written from. */
export interface MainThreadReport<Code extends MainThreadCode> {
	code: Code;
	details: MainThreadDetails[Code];
}

/** The text of a message of the main thread. */
export function mainThreadMessage<Code extends MainThreadCode>({
	code,
	details,
}: MainThreadReport<Code>): string {
	const entry = MAIN_THREAD_CATALOGUE[code];
	return formatMessage({
		sentence: entry.message(details),
		fix: entry.fix(details),
		link: docsLink(entry.docs),
	});
}

/** An error of the main thread: its text is the message, and `code` the message's stable code. */
export type MainThreadError = Error & { code: MainThreadCode };

/** The error for a message of the main thread. */
export function mainThreadError<Code extends MainThreadCode>(
	report: MainThreadReport<Code>,
): MainThreadError {
	return Object.assign(new Error(mainThreadMessage(report)), { code: report.code });
}
