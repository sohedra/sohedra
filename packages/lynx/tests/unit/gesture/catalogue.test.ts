// The gestures' messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import { GESTURE_CATALOGUE, gestureError } from "../../../src/gesture/catalogue.ts";
import type { GestureCode, GestureDetails } from "../../../src/gesture/catalogue.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const SAMPLES: { [Code in GestureCode]: GestureDetails[Code] } = {
	gesture_callback_not_main_thread: { gesture: "PanGesture", name: "onUpdate" },
	gesture_relation_not_gesture: { gesture: "PanGesture", name: "simultaneousWith" },
	gesture_relation_not_a_list: { gesture: "PanGesture", name: "simultaneousWith" },
	gesture_member_not_gesture: { composition: "RaceGesture" },
	relation_call_not_gestures: { call: "waitFor", given: "member" },
};

const CODES = Object.keys(GESTURE_CATALOGUE) as GestureCode[];

describe("the gestures' catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = GESTURE_CATALOGUE[code];
		// The samples hold each code's own details, which TypeScript cannot pair through an index.
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const error = gestureError({ code, details: SAMPLES[code] as never });
		expect(error.code).toBe(code);
		expect(error.message.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(error.message).not.toMatch(INTERNAL_WORDS);
		expect(error.message).toMatchSnapshot();
	});
});
