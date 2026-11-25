// The gestures' messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/gesture/catalogue.test.ts` fails for an entry without a fix or a page, and snapshots
// every message.

import { catalogueError } from "../wire/index.ts";
import type { Catalogue } from "../wire/index.ts";

/** The details each of the gestures' messages is written from. */
export interface GestureDetails {
	/** `gesture` is the class (`PanGesture`), `name` the option (`onUpdate`). */
	gesture_callback_not_main_thread: { gesture: string; name: string };
	/** `gesture` is the class, `name` the option (`simultaneousWith`). */
	gesture_relation_not_gesture: { gesture: string; name: string };
	/** `gesture` is the class, `name` the option (`simultaneousWith`). */
	gesture_relation_not_a_list: { gesture: string; name: string };
	/** `gesture` is the class, `name` the experimental option. */
	gesture_relation_experimental: { gesture: string; name: "waitFor" | "continueWith" };
	/** `composition` is the class (`RaceGesture`). */
	gesture_member_not_gesture: { composition: string };
}

/** What a code of the gestures names. */
export type GestureCode = keyof GestureDetails;

/**
 * The codes only a development build reports. Only code a production build drops reaches their
 * entries, which are kept apart, so it drops their text too.
 */
export type GestureDevelopmentCode = "gesture_relation_experimental";

/** Every message of the gestures that a production build reports. */
export const GESTURE_CATALOGUE: Catalogue<Omit<GestureDetails, GestureDevelopmentCode>> = {
	gesture_callback_not_main_thread: {
		message: ({ gesture, name }) =>
			`The ${name} given to a ${gesture} is not a main-thread function, so the gesture could not run it.`,
		fix: () =>
			"Start the function's body with the 'main thread' directive: a gesture's callbacks run on the main thread.",
		docs: "gesture_callback_not_main_thread",
	},
	gesture_relation_not_gesture: {
		message: ({ gesture, name }) =>
			`The ${name} of a ${gesture} holds a value that is not a gesture, so it cannot name it.`,
		fix: ({ name }) =>
			`Give ${name} the gestures themselves, as made with new: ${name}: [pan], where pan is a PanGesture or another gesture.`,
		docs: "gesture_relation_not_gesture",
	},
	gesture_relation_not_a_list: {
		message: ({ gesture, name }) => `The ${name} of a ${gesture} is not a list of gestures.`,
		fix: ({ name }) => `Give ${name} a list, also for one gesture: ${name}: [pan].`,
		docs: "gesture_relation_not_a_list",
	},
	gesture_member_not_gesture: {
		message: ({ composition }) =>
			`A ${composition} was given a value that is not a gesture, so it cannot hold it.`,
		fix: ({ composition }) =>
			`Give it the gestures themselves, as made with new: new ${composition}(pan, tap).`,
		docs: "gesture_member_not_gesture",
	},
};

/** The messages of the gestures that only a development build reports. */
export const GESTURE_DEVELOPMENT_CATALOGUE: Catalogue<
	Pick<GestureDetails, GestureDevelopmentCode>
> = {
	gesture_relation_experimental: {
		message: ({ gesture, name }) =>
			name === "waitFor"
				? `The waitFor of a ${gesture} is experimental: on Android, a gesture that waits for one on an element around it never runs.`
				: `The continueWith of a ${gesture} is experimental: no device has shown it working yet.`,
		fix: ({ name }) =>
			`Check the gesture on iOS and Android before you rely on ${name}, or leave ${name} out.`,
		docs: "gesture_relation_experimental",
	},
};

/** One message of the gestures: its code and the details it is written from. */
interface GestureReport<Code extends GestureCode> {
	code: Code;
	details: GestureDetails[Code];
}

/** The error for a message of the gestures that a production build reports. */
export function gestureError<Code extends Exclude<GestureCode, GestureDevelopmentCode>>(
	report: GestureReport<Code>,
): Error & { code: Code } {
	return catalogueError(GESTURE_CATALOGUE, report);
}

/**
 * The error for a message only a development build reports, for code a production build drops:
 * elsewhere, its entries would ship.
 */
export function gestureDevelopmentError<Code extends GestureDevelopmentCode>(
	report: GestureReport<Code>,
): Error & { code: Code } {
	return catalogueError(GESTURE_DEVELOPMENT_CATALOGUE, report);
}
