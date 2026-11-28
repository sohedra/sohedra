// The data attributes of a part's enter and exit transitions, as styling hooks.
import type { TransitionStatus } from "@sohedra/primitives-core/foundation/presence/index.js";

import type { StateAttributesMapping } from "../kernel/index.js";

/** The data attributes of a part's enter and exit transitions. */
export const TransitionStatusDataAttributes = {
	/** Present when the component begins animating in. */
	startingStyle: "data-starting-style",
	/** Present when the component is animating out. */
	endingStyle: "data-ending-style",
} as const;

const STARTING = { [TransitionStatusDataAttributes.startingStyle]: "" };
const ENDING = { [TransitionStatusDataAttributes.endingStyle]: "" };

/** `transitionStatus` → `data-starting-style` / `data-ending-style`. */
export const transitionStatusMapping = {
	transitionStatus(value: TransitionStatus): Record<string, string> | null {
		if (value === "starting") {
			return STARTING;
		}
		if (value === "ending") {
			return ENDING;
		}
		return null;
	},
} satisfies StateAttributesMapping<{ transitionStatus: TransitionStatus }>;
