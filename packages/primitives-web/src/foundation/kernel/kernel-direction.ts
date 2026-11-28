// The text direction a DirectionProvider sets for the parts inside it. Core never reads a context;
// a direction-aware part reads this one and passes the direction to its store.

import {
	defineContext,
	type TextDirection,
} from "@sohedra/primitives-core/foundation/kernel/index.js";

export type { TextDirection };

/** Holds the text direction a DirectionProvider sets for its descendants. */
export class DirectionStore {
	#get: () => TextDirection;

	constructor(get: () => TextDirection) {
		this.#get = get;
	}

	get direction(): TextDirection {
		return this.#get();
	}
}

/** The text direction a part sits in: a DirectionProvider sets its store. */
export const DirectionContext = defineContext<DirectionStore>("DirectionProvider");
