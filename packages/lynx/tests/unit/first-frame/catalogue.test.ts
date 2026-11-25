// The first frame's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import {
	FIRST_FRAME_CATALOGUE,
	FIRST_FRAME_DEVELOPMENT_CATALOGUE,
	firstFrameDevelopmentError,
	firstFrameError,
} from "../../../src/first-frame/catalogue.ts";
import type { FirstFrameCode, FirstFrameDetails } from "../../../src/first-frame/catalogue.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const SAMPLES: { [Code in FirstFrameCode]: FirstFrameDetails[Code] } = {
	first_frame_skipped_await: { component: "Feed" },
	main_thread_runtime_missing: { call: "runOnBackground" },
	main_thread_ref_set_outside_function: {},
	run_on_main_thread_in_first_frame: { id: "9aef:c44c3:2" },
	called_on_main_thread: { call: "mount" },
};

/** Every entry: those a production build reports, and those only a development build does. */
const CATALOGUE = { ...FIRST_FRAME_CATALOGUE, ...FIRST_FRAME_DEVELOPMENT_CATALOGUE };
// Boundary: the keys of the catalogue are its codes.
const CODES = Object.keys(CATALOGUE) as FirstFrameCode[];

/** The error for `code`, through the function its code is raised with. */
const errorOf = (code: FirstFrameCode, details: unknown): Error & { code: string } =>
	// The samples hold each code's own details, which TypeScript cannot pair through an index.
	code in FIRST_FRAME_DEVELOPMENT_CATALOGUE
		? firstFrameDevelopmentError({ code, details } as never)
		: firstFrameError({ code, details } as never);

describe("the first frame's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = CATALOGUE[code];
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const error = errorOf(code, SAMPLES[code]);
		expect(error.code).toBe(code);
		expect(error.message.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(error.message).not.toMatch(INTERNAL_WORDS);
		expect(error.message).toMatchSnapshot();
	});
});
