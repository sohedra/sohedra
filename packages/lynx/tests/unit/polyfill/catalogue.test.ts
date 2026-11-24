// The polyfill folder's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import { POLYFILL_CATALOGUE, polyfillError } from "../../../src/polyfill/catalogue.ts";
import type { PolyfillCode, PolyfillDetails } from "../../../src/polyfill/catalogue.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const SAMPLES: { [Code in PolyfillCode]: PolyfillDetails[Code] } = {
	fetch_on_main_thread: {},
};

const CODES = Object.keys(POLYFILL_CATALOGUE) as PolyfillCode[];

describe("the polyfill folder's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = POLYFILL_CATALOGUE[code];
		expect(entry.fix(SAMPLES[code]).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const error = polyfillError(code, SAMPLES[code]);
		expect(error.code).toBe(code);
		expect(error.message.split("\n")[0]).toMatch(/^[A-Za-z`].*\.$/);
		expect(error.message).not.toMatch(INTERNAL_WORDS);
		expect(error.message).toMatchSnapshot();
	});
});
