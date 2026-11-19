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
	ui_method_failed: { method: string; code: number };
	element_has_no_view: { method: string };
	element_left_page: { method: string };
	/** `at` is the index in the markup where it could not be read. */
	first_frame_markup_unreadable: { reason: string; at: number };
	/** `reason` is the first line of what the page's components threw. */
	first_frame_threw: { reason: string };
	rewrite_not_page: { id: number };
	/** `id` is the function's, which names its file and its place in it. */
	main_thread_function_not_found: { id: string };
	main_thread_value_too_deep: { depth: number };
	/** `call` names what was called. */
	page_is_gone: { call: string };
	/** `count` is how many calls had no answer in the task it is reported in. */
	first_frame_call_unanswered: { count: number };
	main_thread_value_not_runnable: Record<string, never>;
	/** `method` is what was called on the element. */
	element_released: { method: string };
	/** `name` is what was given: a function's name, or what the value is. */
	not_a_background_function_handle: { name: string };
	/** `name` is the attribute's. */
	main_thread_attribute_unknown: { name: string };
	/**
	 * `limit` is how many flushes in a row; `fn` the id of the last main-thread function that ran,
	 * `event` its event, `change` the last change it made.
	 */
	main_thread_update_loop: {
		limit: number;
		fn?: string | undefined;
		event?: string | undefined;
		change?: string | undefined;
	};
	/** `url` is the bundle's. */
	lazy_bundle_not_on_main_thread: { url: string };
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
	main_thread_function_not_found: {
		message: ({ id }) =>
			`The main-thread function ${id} has no body on the main thread: the module that declares it did not load there.`,
		fix: () =>
			`A function of a bundle loaded with import() runs once that bundle has loaded. Otherwise, ${REPORT.charAt(0).toLowerCase()}${REPORT.slice(1)}`,
		docs: "main_thread_function_not_found",
	},
	main_thread_value_too_deep: {
		message: ({ depth }) =>
			`A value a main-thread function captured or was given is nested more than ${depth} levels deep, so the function did not run.`,
		fix: () => "Give the function a flatter value, or only the part of it the function reads.",
		docs: "main_thread_value_too_deep",
	},
	page_is_gone: {
		message: ({ call }) =>
			`A call of ${call} has no answer: the page it was made on has been closed or reloaded.`,
		fix: () =>
			"Nothing to fix when the page closed on purpose. Otherwise, stop the timers and animations of a page that reloads, so they make no calls for it.",
		docs: "page_is_gone",
	},
	first_frame_call_unanswered: {
		message: ({ count }) =>
			`A main-thread function called runOnBackground in the first frame, and no background function took the call when the background took the page over, so it has no answer${count > 1 ? ` (${count} calls)` : ""}.`,
		fix: () =>
			"Call it from an element the background renders the same way as the first frame, not one inside {#if mainThread} or a branch the threads take apart, or once the page has started.",
		docs: "first_frame_call_unanswered",
	},
	main_thread_value_not_runnable: {
		message: () =>
			"Lynx asked the main thread to run a value that is not a main-thread function, so nothing ran.",
		fix: () => `The engine handed back something the page did not give it. ${REPORT}`,
		docs: "main_thread_value_not_runnable",
	},
	element_released: {
		message: ({ method }) =>
			`A main-thread function called ${method} on an element the page has let go of, so nothing happened.`,
		fix: () =>
			"Read the element where the function runs, from its event's target or a ref the element holds now, rather than keeping it past its element's life.",
		docs: "element_released",
	},
	not_a_background_function_handle: {
		message: ({ name }) =>
			`The value given to runOnBackground, ${name}, is not a background function it can call, so the call has no answer.`,
		fix: () =>
			"Call runOnBackground(fn) in the body of a function that starts with 'main thread', with fn the background function itself: the build turns it into what the call needs there.",
		docs: "not_a_background_function_handle",
	},
	main_thread_attribute_unknown: {
		message: ({ name }) =>
			`The attribute ${name} binds nothing: a main-thread attribute is main-thread:ref, main-thread:gesture or a main-thread event.`,
		fix: () =>
			"Write a main-thread event as main-thread:ontap, main-thread:ontapcapture, main-thread:oncatchtap or main-thread:oncatchtapcapture, with the event's name in place of tap.",
		docs: "main_thread_attribute_unknown",
	},
	main_thread_update_loop: {
		message: ({ limit, fn, event, change }) =>
			`Main-thread functions changed the page ${limit} times in a row, and the main thread got no turn for anything else: a main-thread function probably changes what makes it run again.` +
			(fn === undefined
				? ""
				: `\nThe last to run was ${fn}${event === undefined ? "" : `, for the event ${event}`}.`) +
			(change === undefined ? "" : `\nIts last change was ${change}.`),
		fix: () =>
			"Change the element only when the value differs, as a layout handler that sets a size or a scroll handler that sets a scroll position must. Until the main thread's next turn, what main-thread functions change is not shown.",
		docs: "main_thread_update_loop",
	},
	lazy_bundle_not_on_main_thread: {
		message: ({ url }) =>
			`The lazy bundle ${url} reached the background but not the main thread, so its main-thread functions and styles are missing.`,
		fix: () =>
			"Check that the bundle is served at that address and that the device reaches it: the main thread takes the bundle again only when the page is opened again.",
		docs: "lazy_bundle_not_on_main_thread",
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
