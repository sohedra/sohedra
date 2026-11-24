// The package's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import { POLYFILL_CATALOGUE, polyfillError } from "../../src/fills/catalogue.ts";
import type { PolyfillCode, PolyfillDetails } from "../../src/fills/catalogue.ts";

/** The package's own words, not the developer's: none may appear in a message. */
const INTERNAL_WORDS =
	/\b(?:vendor|vendored|scope|install(?:Eager|Lazy)|lynx-core|core-js|fills\/)\b/i;

const SAMPLES: { [Code in PolyfillCode]: PolyfillDetails[Code] } = {
	fetch_on_main_thread: {},
	fill_experimental: { global: "URLPattern", module: "@sohedra/lynx-polyfill/url-pattern" },
};

const CODES = Object.keys(POLYFILL_CATALOGUE) as PolyfillCode[];

describe("the package's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = POLYFILL_CATALOGUE[code];
		// The samples hold each code's own details, which TypeScript cannot pair through an index.
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const error = polyfillError(code, SAMPLES[code] as never);
		expect(error.code).toBe(code);
		expect(error.message.split("\n")[0]).toMatch(/^[A-Za-z`].*\.$/);
		expect(error.message).not.toMatch(INTERNAL_WORDS);
		expect(error.message).toMatchSnapshot();
	});
});
