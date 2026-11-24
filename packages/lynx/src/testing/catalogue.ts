// The test library's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/testing/catalogue.test.ts` fails for an entry without a fix or a page, and snapshots
// every message.

import { docsLink, formatMessage } from "../wire/index.ts";
import type { Catalogue } from "../wire/index.ts";

/** The details each of the test library's messages is written from. */
export interface TestingDetails {
	/** `preset` names the test preset to run with: the runner's, or both. */
	render_needs_dom: { preset: string };
	/** `component` is the component's name; `preset` the test preset to run with. */
	first_frame_copy_missing: { component: string; preset: string };
	first_frame_needed_alone: Record<string, never>;
	/** `what` is what was asked for: `rerender()`, `lynx.sendHostEvent()`, `runOnBackground`. */
	background_not_started: { what: string };
	/** `event` is the event's name; `tag` the element's. */
	handler_on_background: { event: string; tag: string };
	page_already_rendered: Record<string, never>;
	/** `call` is what was called: `fireEvent`, `act`. */
	no_page_rendered: { call: string };
	/** `count` is how many errors. */
	page_reported_errors: { count: number };
	/** `tag` is the element's; `kind` the gesture asked for, if any. */
	gesture_missing: { tag: string; kind?: string | undefined };
	/** `tag` is the element's; `kinds` its gestures', in the order they were set. */
	gesture_not_named: { tag: string; kinds: string };
	/** `kind` is the gesture's; `tag` the element's; `name` the callback asked for. */
	gesture_callback_missing: { kind: string; tag: string; name: string };
	/** `tag` is the element's. */
	not_a_list: { tag: string };
}

/** What a code of the test library names. */
export type TestingCode = keyof TestingDetails;

/** Every message of the test library. */
export const TESTING_CATALOGUE: Catalogue<TestingDetails> = {
	render_needs_dom: {
		message: () => "There is no DOM to put the page's elements in, so render could not draw it.",
		fix: ({ preset }) => `Run the test with ${preset}, which sets up jsdom.`,
		docs: "render_needs_dom",
	},
	first_frame_copy_missing: {
		message: ({ component }) =>
			`${component} has no first-frame copy, so render could not draw its first frame.`,
		fix: ({ preset }) =>
			`Run the test with ${preset} without \`firstFrame: false\` in its options, or render without \`lynx: { firstFrame: true }\`.`,
		docs: "first_frame_copy_missing",
	},
	first_frame_needed_alone: {
		message: () =>
			"A page rendered without its background is its first frame alone, so it cannot also leave the first frame out.",
		fix: () =>
			"Leave out `firstFrame: false`, or leave out `background: false` to render on the background.",
		docs: "first_frame_needed_alone",
	},
	background_not_started: {
		message: ({ what }) =>
			`This page has no background thread, which ${what} needs: it was rendered with \`background: false\`.`,
		fix: () => "Render without `background: false` to start the background.",
		docs: "background_not_started",
	},
	handler_on_background: {
		message: ({ event, tag }) =>
			`The ${event} event on a <${tag}> has a handler on the background thread, which this page does not have: the handler did not run.`,
		fix: () => "Render without `background: false` to run it.",
		docs: "handler_on_background",
	},
	page_already_rendered: {
		message: () => "A page is rendered already, and a Lynx view shows one page at a time.",
		fix: () => "End the first page with cleanup() or its unmount() before rendering the next.",
		docs: "page_already_rendered",
	},
	no_page_rendered: {
		message: ({ call }) => `Nothing is rendered, so ${call} has no page to act on.`,
		fix: () => "Render the component first, and await it.",
		docs: "no_page_rendered",
	},
	page_reported_errors: {
		message: ({ count }) => `The page reported ${count} errors while the test waited for it.`,
		fix: () =>
			"Each one is in this error's list of errors: fix the first, which may cause the rest.",
		docs: "page_reported_errors",
	},
	gesture_missing: {
		message: ({ tag, kind }) =>
			kind === undefined
				? `The <${tag}> has no gesture for lynx.gesture to run.`
				: `The <${tag}> has no ${kind} gesture for lynx.gesture to run.`,
		fix: () =>
			"Pass the element whose main-thread:gesture holds the gesture, once the page has set it: await render first.",
		docs: "gesture_missing",
	},
	gesture_not_named: {
		message: ({ tag, kinds }) =>
			`The <${tag}> has several gestures (${kinds}), and lynx.gesture was not told which to run.`,
		fix: () => "Name the kind of gesture to run as the second argument, such as pan or tap.",
		docs: "gesture_not_named",
	},
	gesture_callback_missing: {
		message: ({ kind, tag, name }) =>
			`The ${kind} gesture on the <${tag}> has no ${name} callback to run.`,
		fix: () => "Fire a callback the gesture has, or give the gesture that one.",
		docs: "gesture_callback_missing",
	},
	not_a_list: {
		message: ({ tag }) => `A <${tag}> was given to lynx.list, which drives a <list>.`,
		fix: () => "Pass the <list> element itself.",
		docs: "not_a_list",
	},
};

/** One message of the test library: its code and the details it is written from. */
interface TestingReport<Code extends TestingCode> {
	code: Code;
	details: TestingDetails[Code];
}

/** The text of a message of the test library. */
function testingMessage<Code extends TestingCode>({ code, details }: TestingReport<Code>): string {
	const entry = TESTING_CATALOGUE[code];
	return formatMessage({
		sentence: entry.message(details),
		fix: entry.fix(details),
		link: docsLink(entry.docs),
	});
}

/** The error for a message of the test library: its text is the message, `code` its stable code. */
export function testingError<Code extends TestingCode>(
	report: TestingReport<Code>,
): Error & { code: Code } {
	return Object.assign(new Error(testingMessage(report)), { code: report.code });
}
