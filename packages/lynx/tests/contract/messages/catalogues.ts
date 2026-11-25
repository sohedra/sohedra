// The binding's seven catalogues of messages, one for each program, for the checks that walk them all.

import {
	BACKGROUND_CATALOGUE,
	BACKGROUND_DEVELOPMENT_CATALOGUE,
} from "../../../src/background/catalogue.ts";
import { BUILD_CATALOGUE } from "../../../src/build/diagnostics/catalogue.ts";
import {
	FIRST_FRAME_CATALOGUE,
	FIRST_FRAME_DEVELOPMENT_CATALOGUE,
} from "../../../src/first-frame/catalogue.ts";
import {
	GESTURE_CATALOGUE,
	GESTURE_DEVELOPMENT_CATALOGUE,
} from "../../../src/gesture/catalogue.ts";
import {
	MAIN_THREAD_CATALOGUE,
	MAIN_THREAD_DEVELOPMENT_CATALOGUE,
} from "../../../src/main-thread/catalogue.ts";
import { TESTING_CATALOGUE } from "../../../src/testing/catalogue.ts";
import { WIRE_CATALOGUE, WIRE_DEVELOPMENT_CATALOGUE } from "../../../src/wire/index.ts";
import type { Entry } from "../../../src/wire/index.ts";

/** An entry of any catalogue, for any details. */
export type AnyEntry = Entry<never>;

/** Every catalogue, by the program it belongs to, with the entries only a development build reports. */
export const CATALOGUES: Readonly<Record<string, Readonly<Record<string, AnyEntry>>>> = {
	background: { ...BACKGROUND_CATALOGUE, ...BACKGROUND_DEVELOPMENT_CATALOGUE },
	build: BUILD_CATALOGUE,
	"first-frame": { ...FIRST_FRAME_CATALOGUE, ...FIRST_FRAME_DEVELOPMENT_CATALOGUE },
	gesture: { ...GESTURE_CATALOGUE, ...GESTURE_DEVELOPMENT_CATALOGUE },
	"main-thread": { ...MAIN_THREAD_CATALOGUE, ...MAIN_THREAD_DEVELOPMENT_CATALOGUE },
	testing: TESTING_CATALOGUE,
	wire: { ...WIRE_CATALOGUE, ...WIRE_DEVELOPMENT_CATALOGUE },
};

/**
 * Details for any entry: every field reads as one sample word, so an entry's fix line can be
 * written without the samples of each catalogue's own test.
 */
export const ANY_DETAILS: never = new Proxy(
	{},
	{ get: (_target, key) => (key === Symbol.toPrimitive ? undefined : "sample") },
) as never;
