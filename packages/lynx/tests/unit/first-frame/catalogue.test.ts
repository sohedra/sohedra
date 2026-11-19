// The first frame's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import { FIRST_FRAME_CATALOGUE, firstFrameError } from "../../../src/first-frame/catalogue.ts";
import type { FirstFrameCode, FirstFrameDetails } from "../../../src/first-frame/catalogue.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const SAMPLES: { [Code in FirstFrameCode]: FirstFrameDetails[Code] } = {
	first_frame_skipped_await: { component: "Feed" },
	main_thread_runtime_missing: { call: "runOnBackground" },
	main_thread_ref_set_outside_function: {},
	run_on_main_thread_in_first_frame: { id: "9aef:c44c3:2" },
	called_on_main_thread: { call: "mount" },
};

// Boundary: the keys of the catalogue are its codes.
const CODES = Object.keys(FIRST_FRAME_CATALOGUE) as FirstFrameCode[];

describe("the first frame's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES)).toEqual(CODES);
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = FIRST_FRAME_CATALOGUE[code];
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const error = firstFrameError({ code, details: SAMPLES[code] as never });
		expect(error.code).toBe(code);
		expect(error.message.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(error.message).not.toMatch(INTERNAL_WORDS);
		expect(error.message).toMatchSnapshot();
	});
});
