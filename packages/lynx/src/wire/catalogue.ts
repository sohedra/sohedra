// The wire's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/wire/catalogue.test.ts` fails for an entry without a fix or a page, and snapshots
// every message.

import { catalogueError, catalogueMessage } from "./messages.ts";
import type { Catalogue } from "./messages.ts";
import type { Thread } from "./names.ts";

/** The details each of the wire's messages is written from. */
export interface WireDetails {
	threads_from_different_builds: { thread: Thread; received: number; expected: number };
	page_reloaded_on_one_thread: { thread: Thread; received: number; generation: number };
	/** `thread` is the thread the value was sent to. */
	value_not_copyable: { thread: Thread; reason: string };
	/**
	 * `name`: a global the app read; `module`: the import of @sohedra/lynx-polyfill that fills it;
	 * `baseline`: whether the catch-all import fills it too.
	 */
	global_not_filled: { name: string; module: string; baseline: boolean };
	/** `name`: a global the main thread read, which only the background has. */
	global_background_only: { name: string };
	/** `name`: a global the app read, which no fill gives; `instead`: what to use. */
	global_not_on_lynx: { name: string; instead: string };
	/** `thread`: the thread that refused the call. */
	page_already_mounted: { thread: Thread };
	/**
	 * `reason` is what the background threw as it mounted the root component (the component, or the
	 * `props` function), whose error has the thrown value as its `cause`; a call the main thread
	 * refuses has none.
	 */
	page_not_started: { reason?: string | undefined };
	hydratable_not_on_lynx: Record<string, never>;
}

/** What a code of the wire names. */
export type WireCode = keyof WireDetails;

/** Each thread, as a message names it. */
export const THREAD_NAMES: Record<Thread, string> = {
	background: "the background",
	"main-thread": "the main thread",
};

/**
 * The codes only a development build reports. Only code a production build drops reaches their
 * entries, which are kept apart (./development-catalogue.ts), so it drops their text too.
 */
export type WireDevelopmentCode = "threads_from_different_builds" | "page_reloaded_on_one_thread";

/** Every message of the wire that a production build reports. */
export const WIRE_CATALOGUE: Catalogue<Omit<WireDetails, WireDevelopmentCode>> = {
	value_not_copyable: {
		message: ({ thread, reason }) =>
			`A value sent to ${THREAD_NAMES[thread]} cannot be copied (${reason.split("\n")[0]!.trim()}).`,
		fix: () =>
			"Send plain data: strings, numbers, booleans, null, arrays and plain objects, without cycles or BigInt values.",
		docs: "value_not_copyable",
	},
	global_not_filled: {
		message: ({ name }) =>
			`The global \`${name}\` is not defined: Lynx's engine doesn't have it, and no import put it there.`,
		fix: ({ module, baseline }) =>
			`Import "${module}" in the first line of the app's entry${baseline ? ', or "@sohedra/lynx-polyfill", which holds it too' : ""}.`,
		docs: "global_not_filled",
	},
	global_background_only: {
		message: ({ name }) =>
			`The global \`${name}\` is not defined on the main thread: Lynx has it on the background thread only.`,
		fix: () =>
			"Use it in code that runs on the background, such as an effect or an event handler, or call such code from a main-thread function with `runOnBackground`.",
		docs: "global_background_only",
	},
	global_not_on_lynx: {
		message: ({ name }) =>
			`The global \`${name}\` is not defined: Lynx's engine doesn't have it, and no fill gives it.`,
		fix: ({ instead }) => instead,
		docs: "global_not_on_lynx",
	},
	page_already_mounted: {
		message: ({ thread }) =>
			`A second call of \`mountPage\` did nothing: the page the first call started still runs.\nSeen on ${THREAD_NAMES[thread]}.`,
		fix: () =>
			"Call `mountPage` once, in the page's entry. To show a component over the page, call `mount`; to show another page, change what the root component shows.",
		docs: "page_already_mounted",
	},
	page_not_started: {
		message: ({ reason }) =>
			`The page did not start: the background threw as it mounted the root component${reason === undefined ? "" : ` (${reason.split("\n")[0]!.trim()})`}, so its first frame stays and answers nothing.`,
		fix: () =>
			"Fix what threw (the cause of the page_not_started error), or wrap the part that can throw in a <svelte:boundary> with a failed snippet.",
		docs: "page_not_started",
	},
	hydratable_not_on_lynx: {
		message: () =>
			"Svelte's hydratable ran on the main thread, and Lynx has no way to carry its value to the background.",
		fix: () =>
			"Load the value on the background instead: in an effect, or with await inside a <svelte:boundary> with a pending snippet.",
		docs: "hydratable_not_on_lynx",
	},
};

/** One message of the wire: its code and the details it is written from. */
export interface WireReport<Code extends WireCode> {
	code: Code;
	details: WireDetails[Code];
}

/** An error of the wire: its text is the message, and `code` the message's stable code. */
type WireError = Error & { code: WireCode };

/** The text of a message of the wire that a production build reports. */
export function wireMessage<Code extends Exclude<WireCode, WireDevelopmentCode>>(
	report: WireReport<Code>,
): string {
	return catalogueMessage(WIRE_CATALOGUE, report);
}

/** The error for a message of the wire that a production build reports. */
export function wireError<Code extends Exclude<WireCode, WireDevelopmentCode>>(
	report: WireReport<Code>,
): WireError {
	return catalogueError(WIRE_CATALOGUE, report);
}
