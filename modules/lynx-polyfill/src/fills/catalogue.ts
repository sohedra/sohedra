// The package's messages, one entry for each: the plain sentence, the fix and the docs page, in the
// shape of Sohedra's other catalogues (the same entry fields, the same docs pages). The package
// imports nothing of Sohedra's binding, so it keeps its own. `tests/unit/catalogue.test.ts` fails
// for an entry without a fix or a page, and snapshots every message. The standards' own errors (a
// `TypeError` where a standard says to throw one) are not messages of the package's.

/** Where the docs pages of messages live; a message's page is its code under `/e/`. */
const DOCS_BASE = "https://sohedra.com/e/";

/** The details each of the folder's messages is written from. */
export interface PolyfillDetails {
	fetch_on_main_thread: Record<string, never>;
	/** `global`: the global first read; `module`: the import that installs its fill. */
	fill_experimental: { global: string; module: string };
}

/** What a code of the folder names. */
export type PolyfillCode = keyof PolyfillDetails;

/** One message: its sentence and fix for the details it needs, and its docs page. */
export interface PolyfillEntry<Details> {
	message: (details: Details) => string;
	fix: (details: Details) => string;
	docs: string;
}

/** Every message of the package. */
export const POLYFILL_CATALOGUE: {
	readonly [Code in PolyfillCode]: PolyfillEntry<PolyfillDetails[Code]>;
} = {
	fetch_on_main_thread: {
		message: () => "fetch was called on the main thread, where it does not run.",
		fix: () =>
			"Call fetch from code that runs on the background thread, such as an effect or an event handler; a main-thread function hands the call to the background first (in Sohedra, with `runOnBackground`).",
		docs: "fetch_on_main_thread",
	},
	fill_experimental: {
		message: ({ global, module }) =>
			`\`${global}\` comes from the experimental fill of \`${module}\`: it may change in any minor release, and not all of its web platform tests pass on Lynx yet.`,
		fix: () =>
			"If it does something a browser would not, open an issue with a reproduction. This warning shows once, in development builds only.",
		docs: "fill_experimental",
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
