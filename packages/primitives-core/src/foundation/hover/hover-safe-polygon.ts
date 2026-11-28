// One hover-out's safe polygon: the pointer's path from the trigger to the popup, between two moves.

import type { PhysicalSide } from "../position/index.js";
import {
	decideSafePolygon,
	type SafePolygonDecision,
	type SafePolygonInput,
	type SafePolygonTrack,
	startSafePolygon,
} from "./hover-safe-polygon-rules.js";

/** One hover-out's safe polygon: where it stands between two pointer moves. */
export class SafePolygon {
	#track: SafePolygonTrack;

	/** `x` and `y` are where the pointer left the trigger, `side` the popup's physical side. */
	constructor(side: PhysicalSide, x: number, y: number, now: number) {
		this.#track = startSafePolygon(side, x, y, now);
	}

	decide(input: SafePolygonInput): SafePolygonDecision {
		const next = decideSafePolygon(this.#track, input);
		this.#track = next.track;
		return next.decision;
	}
}
