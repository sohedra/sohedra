// A popup's styling hooks on the web: how popup state maps to data attributes.
import type { TransitionStatus } from "@sohedra/primitives-core/foundation/presence/index.js";

import type { StateAttributesMapping } from "../kernel/index.js";
import { transitionStatusMapping } from "../presence/index.js";

const OPEN = { "data-open": "" };
const CLOSED = { "data-closed": "" };
const ANCHOR_HIDDEN = { "data-anchor-hidden": "" };

/** `open` → `data-open` / `data-closed`, `anchorHidden` → `data-anchor-hidden`. */
export const popupStateMapping = {
	open(value: boolean): Record<string, string> {
		return value ? OPEN : CLOSED;
	},
	anchorHidden(value: boolean): Record<string, string> | null {
		return value ? ANCHOR_HIDDEN : null;
	},
} satisfies StateAttributesMapping<{ open: boolean; anchorHidden: boolean }>;

/** {@link popupStateMapping} plus `data-starting-style` / `data-ending-style`. */
export const popupTransitionStateMapping = {
	...popupStateMapping,
	...transitionStatusMapping,
} satisfies StateAttributesMapping<{
	open: boolean;
	anchorHidden: boolean;
	transitionStatus: TransitionStatus;
}>;

/** A Viewport's `activationDirection` → `data-activation-direction`. */
export const popupViewportStateMapping = {
	activationDirection(value: string | undefined): Record<string, string> | null {
		return value ? { "data-activation-direction": value } : null;
	},
} satisfies StateAttributesMapping<{ activationDirection: string | undefined }>;
