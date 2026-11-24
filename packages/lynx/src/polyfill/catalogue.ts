// The polyfill folder's messages, one entry for each: the plain sentence, the fix and the docs page.
// The folder imports nothing of the binding, so it keeps its own catalogue in the binding's shape
// (wire/messages.ts: the same entry fields, the same text, the same docs pages), and the binding's
// walk over every catalogue reads this one too. `tests/unit/polyfill/catalogue.test.ts` fails for an
// entry without a fix or a page, and snapshots every message. The standards' own errors (a
// `TypeError` where a standard says to throw one) are not messages of the folder's.

/** Where the docs pages of messages live; a message's page is its code under `/e/`. */
const DOCS_BASE = "https://sohedra.com/e/";

/** The details each of the folder's messages is written from. */
export interface PolyfillDetails {
	fetch_on_main_thread: Record<string, never>;
}

/** What a code of the folder names. */
export type PolyfillCode = keyof PolyfillDetails;

/** One message: its sentence and fix for the details it needs, and its docs page. */
export interface PolyfillEntry<Details> {
	message: (details: Details) => string;
	fix: (details: Details) => string;
	docs: string;
}

/** Every message of the polyfill folder. */
export const POLYFILL_CATALOGUE: {
	readonly [Code in PolyfillCode]: PolyfillEntry<PolyfillDetails[Code]>;
} = {
	fetch_on_main_thread: {
		message: () => "fetch was called on the main thread, where it does not run.",
		fix: () =>
			"Call fetch on the background thread: in an `$effect`, an event handler, or a function a main-thread function calls with `runOnBackground`.",
		docs: "fetch_on_main_thread",
	},
};

/** The error for a message of the folder: its text is the message, `code` its stable code. */
export function polyfillError<Code extends PolyfillCode>(
	code: Code,
	details: PolyfillDetails[Code],
): Error & { code: Code } {
	const entry = POLYFILL_CATALOGUE[code];
	const text = [entry.message(details), "", entry.fix(details), `${DOCS_BASE}${entry.docs}`].join(
		"\n",
	);
	// Boundary: an Error given its code, as the binding's errors carry theirs.
	const error = new Error(text) as Error & { code: Code };
	error.code = code;
	return error;
}
