// Several gestures on one element: what `./experimental` offers until a device shows them working.
// A composition gives its members the relations it means, on copies, so a member keeps its own.
//
// What Android shows (Lynx 4.2): two gestures of one type on one element run as one, the last,
// since Android keys an element's handlers by type; setting one member again restarts the drag of
// the others; and a relation to an id an element did not have when it joined Android's gesture
// arena does not resolve.
//
// Adapted from @lynx-js/gesture-runtime (lynx-stack/packages/lynx/gesture-runtime/src), Copyright
// 2025 The Lynx Authors, Apache License 2.0: the compositions' relations.

// By the entry's name: the compositions take the one `Gesture` every entry's declarations name.
import type { Gesture } from "@sohedra/lynx/gesture";

import { GestureType } from "../wire/index.ts";
import type { GestureRef, SerializedGesture } from "../wire/index.ts";
import { gestureError } from "./catalogue.ts";
import { crossing, GestureBase, merge, refsOf } from "./gestures.ts";

/** What a composition adds to its members' relations. */
interface Added {
	waitFor: readonly GestureRef[];
	simultaneousWith: readonly GestureRef[];
}

/** `gesture` with `added`: a copy, its members copied too. */
function withRelations(gesture: SerializedGesture, added: Added): SerializedGesture {
	if (gesture.type === GestureType.COMPOSED)
		return { ...gesture, gestures: gesture.gestures.map((member) => withRelations(member, added)) };
	return {
		...gesture,
		waitFor: merge(gesture.waitFor, added.waitFor, gesture.id),
		simultaneousWith: merge(gesture.simultaneousWith, added.simultaneousWith, gesture.id),
	};
}

/** How a composition relates each member to the others. */
type Relate = (member: number, members: readonly SerializedGesture[]) => Added;

/** Several gestures on one element. */
abstract class ComposedGesture extends GestureBase {
	private readonly type: typeof GestureType.COMPOSED;
	private readonly gestures: SerializedGesture[];

	/** @internal */
	protected constructor(composition: string, gestures: readonly Gesture[], relate: Relate) {
		super();
		const members = gestures.map((gesture) => {
			const member = crossing(gesture);
			if (!member)
				throw gestureError({ code: "gesture_member_not_gesture", details: { composition } });
			return member;
		});
		this.type = GestureType.COMPOSED;
		this.gestures = members.map((member, index) => withRelations(member, relate(index, members)));
	}
}

const NONE: Added = { waitFor: [], simultaneousWith: [] };

/**
 * Several gestures on one element, of which the first to begin wins. Experimental: Lynx follows
 * the relations of only the first detector of an element that has one, on iOS and Android.
 */
export class RaceGesture extends ComposedGesture {
	constructor(...gestures: Gesture[]) {
		super("RaceGesture", gestures, () => NONE);
	}
}

/**
 * Several gestures on one element that may run together. Experimental, as `RaceGesture`: on
 * Android, a pan with a tap runs both, two pans only the second.
 */
export class SimultaneousGesture extends ComposedGesture {
	constructor(...gestures: Gesture[]) {
		super("SimultaneousGesture", gestures, (index, members) => ({
			waitFor: [],
			simultaneousWith: refsOf(members.filter((_, other) => other !== index)),
		}));
	}
}

/**
 * Several gestures on one element, in order of priority: each begins only once all before it
 * failed. Experimental, as `RaceGesture`.
 */
export class ExclusiveGesture extends ComposedGesture {
	constructor(...gestures: Gesture[]) {
		super("ExclusiveGesture", gestures, (index, members) => ({
			waitFor: refsOf(members.slice(0, index)),
			simultaneousWith: [],
		}));
	}
}
