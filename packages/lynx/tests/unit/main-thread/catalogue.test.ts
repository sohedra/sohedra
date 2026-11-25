// The main thread's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import {
	MAIN_THREAD_CATALOGUE,
	MAIN_THREAD_DEVELOPMENT_CATALOGUE,
	mainThreadDevelopmentError,
	mainThreadError,
} from "../../../src/main-thread/catalogue.ts";
import type { MainThreadCode, MainThreadDetails } from "../../../src/main-thread/catalogue.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const SAMPLES: { [Code in MainThreadCode]: MainThreadDetails[Code] } = {
	change_not_applied: {
		reason: "The main thread has no element 7.",
		change: "insert <view> 42 into <scroll-view> 7",
	},
	element_missing: { id: 7 },
	ui_method_failed: { method: "setValue", code: 4 },
	element_has_no_view: { method: "boundingClientRect" },
	element_left_page: { method: "scrollTo" },
	first_frame_markup_unreadable: { reason: "the value of class on <view> is not quoted", at: 11 },
	first_frame_threw: { reason: "NativeModules is not defined" },
	rewrite_not_page: { id: 7 },
	list_row_not_written: { id: 12 },
	main_thread_function_not_found: { id: "9aef:c44c3:1" },
	main_thread_value_too_deep: { depth: 1000 },
	page_is_gone: { call: "runOnBackground" },
	first_frame_call_unanswered: { count: 3 },
	main_thread_value_not_runnable: {},
	element_released: { method: "setStyleProperty" },
	not_a_background_function_handle: { name: "save" },
	main_thread_attribute_unknown: { name: "main-thread:bindtap-later" },
	main_thread_update_loop: {
		limit: 1000,
		fn: "9aef:c44c3:2",
		event: "layoutchange",
		change: "setStyleProperty(height)",
	},
	lazy_bundle_not_on_main_thread: { url: "https://cdn.example/lazy-bundle/Chart.bundle" },
};

/** Every entry: those a production build reports, and those only a development build does. */
const CATALOGUE = { ...MAIN_THREAD_CATALOGUE, ...MAIN_THREAD_DEVELOPMENT_CATALOGUE };
// Boundary: the keys of the catalogue are its codes.
const CODES = Object.keys(CATALOGUE) as MainThreadCode[];

/** The error for `code`, through the function its code is raised with. */
const errorOf = (code: MainThreadCode, details: unknown): Error =>
	// The samples hold each code's own details, which TypeScript cannot pair through an index.
	code in MAIN_THREAD_DEVELOPMENT_CATALOGUE
		? mainThreadDevelopmentError({ code, details } as never)
		: mainThreadError({ code, details } as never);

describe("the main thread's catalogue", () => {
	it("has a sample for each entry", () => {
		const byName = (a: string, b: string): number => a.localeCompare(b);
		expect(Object.keys(SAMPLES).sort(byName)).toEqual([...CODES].sort(byName));
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = CATALOGUE[code];
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const text = errorOf(code, SAMPLES[code]).message;
		expect(text.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(text).not.toMatch(INTERNAL_WORDS);
		expect(text).toMatchSnapshot();
	});
});
