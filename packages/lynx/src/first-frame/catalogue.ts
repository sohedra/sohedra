// The first frame's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/first-frame/catalogue.test.ts` fails for an entry without a fix or a page, and
// snapshots every message.

import { catalogueError } from "../wire/index.ts";
import type { Catalogue } from "../wire/index.ts";

/** The details each of the first frame's messages is written from. */
export interface FirstFrameDetails {
	/** `component` is the page's root component. */
	first_frame_skipped_await: { component: string };
	/** `call` is what the page's code called: `runOnBackground` or `runOnMainThread`. */
	main_thread_runtime_missing: { call: string };
	main_thread_ref_set_outside_function: Record<string, never>;
	/** `id` is the function's, which names its file and its place in it. */
	run_on_main_thread_in_first_frame: { id: string };
	/** `call` is what the page's code called, as written: `mount`, `createStaticCopy`, `on(root, …)`. */
	called_on_main_thread: { call: string };
}

/** What a code of the first frame names. */
export type FirstFrameCode = keyof FirstFrameDetails;

/**
 * The codes only a development build reports. Only code a production build drops reaches their
 * entries, which are kept apart, so it drops their text too.
 */
export type FirstFrameDevelopmentCode =
	| "first_frame_skipped_await"
	| "run_on_main_thread_in_first_frame";

/** Every message of the first frame that a production build reports. */
export const FIRST_FRAME_CATALOGUE: Catalogue<Omit<FirstFrameDetails, FirstFrameDevelopmentCode>> =
	{
		main_thread_runtime_missing: {
			message: ({ call }) =>
				`A call of ${call} ran on the main thread before its runtime started, so it has no answer.`,
			fix: () =>
				"Call it from a main-thread function that an event, a ref or the background runs, not while the page's modules load.",
			docs: "main_thread_runtime_missing",
		},
		main_thread_ref_set_outside_function: {
			message: () =>
				"The current value of a main-thread ref was set outside a main-thread function, as the first frame was drawn.",
			fix: () =>
				"Set it inside a main-thread function. A component's top-level code runs on both threads, and a ref's value lives on the main thread.",
			docs: "main_thread_ref_set_outside_function",
		},
		called_on_main_thread: {
			message: ({ call }) =>
				`A call of ${call} ran on the main thread, and ${call} works only on the background thread, which holds the page's components and elements.`,
			fix: () =>
				"Call it from $effect, an attachment or an event handler, which run on the background thread: not while a component renders the first frame, and not in a main-thread function.",
			docs: "called_on_main_thread",
		},
	};

/** The messages of the first frame that only a development build reports. */
export const FIRST_FRAME_DEVELOPMENT_CATALOGUE: Catalogue<
	Pick<FirstFrameDetails, FirstFrameDevelopmentCode>
> = {
	first_frame_skipped_await: {
		message: ({ component }) =>
			`The page ${component} has no first frame: a component in it (Svelte does not say which) awaits outside a <svelte:boundary> with a pending snippet, and the first frame is drawn without waiting.`,
		fix: () =>
			"Put the part that awaits in a <svelte:boundary> with a pending snippet: the first frame then shows the pending snippet, and the page shows the rest when it is ready.",
		docs: "first_frame_skipped_await",
	},
	run_on_main_thread_in_first_frame: {
		message: ({ id }) =>
			`A runOnMainThread call of ${id} was made as the first frame was drawn, and does nothing there: it runs once the page starts, when the background makes the same call.`,
		fix: () =>
			"To run it as the page starts, call it from $effect. To run it on an element from the first frame on, once, give the element a function ref: main-thread:ref={fn}.",
		docs: "run_on_main_thread_in_first_frame",
	},
};

/** One message of the first frame: its code and the details it is written from. */
interface FirstFrameReport<Code extends FirstFrameCode> {
	code: Code;
	details: FirstFrameDetails[Code];
}

/** The error for a message of the first frame that a production build reports. */
export function firstFrameError<Code extends Exclude<FirstFrameCode, FirstFrameDevelopmentCode>>(
	report: FirstFrameReport<Code>,
): Error & { code: Code } {
	return catalogueError(FIRST_FRAME_CATALOGUE, report);
}

/**
 * The error for a message only a development build reports, for code a production build drops:
 * elsewhere, its entries would ship.
 */
export function firstFrameDevelopmentError<Code extends FirstFrameDevelopmentCode>(
	report: FirstFrameReport<Code>,
): Error & { code: Code } {
	return catalogueError(FIRST_FRAME_DEVELOPMENT_CATALOGUE, report);
}
