// The main thread's messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import { MAIN_THREAD_CATALOGUE, mainThreadMessage } from "../../../src/main-thread/catalogue.ts";
import type { MainThreadCode, MainThreadDetails } from "../../../src/main-thread/catalogue.ts";

const SAMPLES: { [Code in MainThreadCode]: MainThreadDetails[Code] } = {
	change_not_applied: {
		reason: "The main thread has no element 7.",
		change: "insert <view> 42 into <scroll-view> 7",
	},
	element_missing: { id: 7 },
	call_not_supported: { kind: "run" },
	ui_method_failed: { method: "setValue", code: 4 },
	element_has_no_view: { method: "boundingClientRect" },
	element_left_page: { method: "scrollTo" },
	first_frame_markup_unreadable: { reason: "the value of class on <view> is not quoted", at: 11 },
	first_frame_threw: { reason: "NativeModules is not defined" },
};

// Boundary: the keys of the catalogue are its codes.
const CODES = Object.keys(MAIN_THREAD_CATALOGUE) as MainThreadCode[];

describe("the main thread's catalogue", () => {
	it("has a sample for each entry", () => {
		const byName = (a: string, b: string): number => a.localeCompare(b);
		expect(Object.keys(SAMPLES).sort(byName)).toEqual([...CODES].sort(byName));
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = MAIN_THREAD_CATALOGUE[code];
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const text = mainThreadMessage({ code, details: SAMPLES[code] as never });
		expect(text.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(text).not.toMatch(/\b(?:patch|op|ops|worklet|lepus|svelte-lynx|generation|wire)\b/i);
		expect(text).toMatchSnapshot();
	});
});
