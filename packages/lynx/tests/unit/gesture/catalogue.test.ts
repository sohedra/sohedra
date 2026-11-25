// The gestures' messages: every entry has its fix and its docs page, and every message is a
// snapshot.

import { describe, expect, it } from "@rstest/core";

import {
	GESTURE_CATALOGUE,
	GESTURE_DEVELOPMENT_CATALOGUE,
	gestureDevelopmentError,
	gestureError,
} from "../../../src/gesture/catalogue.ts";
import type { GestureCode, GestureDetails } from "../../../src/gesture/catalogue.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const SAMPLES: { [Code in GestureCode]: GestureDetails[Code] } = {
	gesture_callback_not_main_thread: { gesture: "PanGesture", name: "onUpdate" },
	gesture_relation_not_gesture: { gesture: "PanGesture", name: "simultaneousWith" },
	gesture_relation_not_a_list: { gesture: "PanGesture", name: "simultaneousWith" },
	gesture_relation_experimental: { gesture: "TapGesture", name: "waitFor" },
	gesture_member_not_gesture: { composition: "RaceGesture" },
};

/** Every entry: those a production build reports, and those only a development build does. */
const CATALOGUE = { ...GESTURE_CATALOGUE, ...GESTURE_DEVELOPMENT_CATALOGUE };
const CODES = Object.keys(CATALOGUE) as GestureCode[];

/** The error for `code`, through the function its code is raised with. */
const errorOf = (code: GestureCode, details: unknown): Error & { code: string } =>
	// The samples hold each code's own details, which TypeScript cannot pair through an index.
	code in GESTURE_DEVELOPMENT_CATALOGUE
		? gestureDevelopmentError({ code, details } as never)
		: gestureError({ code, details } as never);

describe("the gestures' catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = CATALOGUE[code];
		// The samples hold each code's own details, which TypeScript cannot pair through an index.
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

	it("gesture_relation_experimental: the message for continueWith, which no device has run", () => {
		const error = gestureDevelopmentError({
			code: "gesture_relation_experimental",
			details: { gesture: "PanGesture", name: "continueWith" },
		});
		expect(error.message.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(error.message).toMatchSnapshot();
	});
});
