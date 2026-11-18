// Several gestures on one element, and a gesture that hands the touch on: what `./experimental`
// offers until a device shows it. A composition gives its members the relations it means, on
// copies, so a member keeps its own.
//
// Adapted from @lynx-js/gesture-runtime (lynx-stack/packages/lynx/gesture-runtime/src), Copyright
// 2025 The Lynx Authors, Apache License 2.0: the compositions' relations.

import { GestureType } from "../wire/index.ts";
import type { GestureRef, SerializedGesture } from "../wire/index.ts";
import { gestureError } from "./catalogue.ts";
import { crossing, Gesture, merge, refsOf } from "./gestures.ts";
import type { GestureKind } from "./gestures.ts";

/** What a composition adds to its members' relations. */
interface Added {
	waitFor: readonly GestureRef[];
	simultaneousWith: readonly GestureRef[];
	continueWith?: readonly GestureRef[];
}

/** `gesture` with `added`: a copy, its members copied too. */
function withRelations(gesture: SerializedGesture, added: Added): SerializedGesture {
	if (gesture.type === GestureType.COMPOSED)
		return { ...gesture, gestures: gesture.gestures.map((member) => withRelations(member, added)) };
	return {
		...gesture,
		waitFor: merge(gesture.waitFor, added.waitFor, gesture.id),
		simultaneousWith: merge(gesture.simultaneousWith, added.simultaneousWith, gesture.id),
		continueWith: merge(gesture.continueWith, added.continueWith ?? [], gesture.id),
	};
}

/** How a composition relates each member to the others. */
type Relate = (member: number, members: readonly SerializedGesture[]) => Added;

/** Several gestures on one element. */
abstract class ComposedGesture extends Gesture {
	private readonly type: typeof GestureType.COMPOSED;
	private readonly gestures: SerializedGesture[];

	protected constructor(composition: string, kinds: readonly GestureKind[], relate: Relate) {
		super();
		const members = kinds.map((kind) => {
			const member = crossing(kind);
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
	constructor(...gestures: GestureKind[]) {
		super("RaceGesture", gestures, () => NONE);
	}
}

/** Several gestures on one element that may run together. Experimental, as `RaceGesture`. */
export class SimultaneousGesture extends ComposedGesture {
	constructor(...gestures: GestureKind[]) {
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
	constructor(...gestures: GestureKind[]) {
		super("ExclusiveGesture", gestures, (index, members) => ({
			waitFor: refsOf(members.slice(0, index)),
			simultaneousWith: [],
		}));
	}
}

/**
 * A copy of `gesture` that hands the touch to the gestures of `next` when it ends. The copy keeps
 * the gesture's id, so a relation that names the gesture names the copy too. Experimental: no
 * device has shown it.
 */
export function continueWith<Kind extends GestureKind>(
	gesture: Kind,
	next: readonly GestureKind[],
): Kind {
	const own = crossing(gesture);
	if (!own)
		throw gestureError({ code: "continue_with_not_gestures", details: { given: "gesture" } });
	if (!Array.isArray(next))
		throw gestureError({ code: "continue_with_not_gestures", details: { given: "list" } });
	const following = next.map(crossing);
	if (following.some((value) => value === undefined))
		throw gestureError({ code: "continue_with_not_gestures", details: { given: "member" } });
	const added = withRelations(own, {
		...NONE,
		continueWith: refsOf(following.filter((value) => value !== undefined)),
	});
	// Boundary: the copy is the same class's instance, its fields the gesture as it crosses.
	return Object.assign(Object.create(Object.getPrototypeOf(gesture) as object) as Kind, added);
}
