// The test library's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import { TESTING_CATALOGUE, testingError } from "../../../src/testing/catalogue.ts";
import type { TestingCode, TestingDetails } from "../../../src/testing/catalogue.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const PRESET = "withSvelteLynx() from @sohedra/lynx/config/rstest";

const SAMPLES: { [Code in TestingCode]: TestingDetails[Code] } = {
	render_needs_dom: { preset: PRESET },
	first_frame_copy_missing: { component: "Card", preset: PRESET },
	first_frame_needed_alone: {},
	background_not_started: { what: "rerender()" },
	handler_on_background: { event: "tap", tag: "view" },
	page_already_rendered: {},
	no_page_rendered: { call: "fireEvent" },
	page_reported_errors: { count: 2 },
	gesture_missing: { tag: "view", kind: "pan" },
	gesture_not_named: { tag: "view", kinds: "pan, tap" },
	gesture_callback_missing: { kind: "pan", tag: "view", name: "onSwipe" },
	not_a_list: { tag: "view" },
};

const CODES = Object.keys(TESTING_CATALOGUE) as TestingCode[];

describe("the test library's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = TESTING_CATALOGUE[code];
		// The samples hold each code's own details, which TypeScript cannot pair through an index.
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const error = testingError({ code, details: SAMPLES[code] as never });
		expect(error.code).toBe(code);
		expect(error.message.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(error.message).not.toMatch(INTERNAL_WORDS);
		expect(error.message).toMatchSnapshot();
	});

	it("names a gesture without a kind when none was asked for", () => {
		expect(testingError({ code: "gesture_missing", details: { tag: "text" } }).message).toMatch(
			/^The <text> has no gesture for lynx\.gesture to run\./,
		);
	});
});
