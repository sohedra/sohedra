// `String.prototype.normalize`: ECMA-262 § 22.1.3.15, over unorm's normalization (UAX #15). PrimJS
// has it only with its Unicode tables, which Lynx builds it without. Leaves out what Unicode
// assigned after 8.0 (unorm's data, 2015): such a character is left as it is, and so is its order
// among combining marks. Not in the baseline, for its size:
// `@sohedra/lynx-polyfill/normalize` installs it.

import { installEager } from "../install.ts";
import { loadForms } from "../vendor/normalize.js";
import type { NormalizationForm } from "../vendor/normalize.js";

/**
 * Missing on both threads: Lynx builds PrimJS without `CONFIG_ALL_UNICODE`.
 *
 * @workaround language-normalize kind=lynx-gap delete-when="Lynx builds PrimJS with its Unicode tables (CONFIG_ALL_UNICODE) on both threads"
 */
export function fillNormalize(): void {
	installEager(
		String.prototype,
		"normalize",
		normalize,
		(existing) => typeof existing === "function",
	);
}

/** unorm's forms, loaded on the first call: its data takes milliseconds to read. */
let forms: Record<string, NormalizationForm> | undefined;

/**
 * The specification's steps. A method, as a built-in's is: it can't be called with `new`. Its
 * `length` is the specification's 0: the form is read from the arguments.
 */
const { normalize } = {
	normalize(this: unknown, ...args: unknown[]): string {
		if (this === null || this === undefined)
			throw new TypeError("String.prototype.normalize was called on null or undefined.");
		// A template, as `ToString`: it throws for a Symbol.
		const text = `${this as string}`;
		const name = args[0] === undefined ? "NFC" : `${args[0] as string}`;
		if (!FORMS.includes(name))
			throw new RangeError(
				`String.prototype.normalize takes "NFC", "NFD", "NFKC" or "NFKD", and was given "${name}".`,
			);
		forms ??= loadForms();
		return forms[name]!(text);
	},
};

/** The forms' names, as the specification lists them. */
const FORMS: readonly string[] = ["NFC", "NFD", "NFKC", "NFKD"];
