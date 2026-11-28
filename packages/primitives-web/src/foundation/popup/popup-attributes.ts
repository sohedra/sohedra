// A popup's styling hooks on the web: the data attributes every popup's parts render, and how
// popup state maps to them.
import type { TransitionStatus } from "@sohedra/primitives-core/foundation/presence/index.js";

import type { StateAttributesMapping } from "../kernel/index.js";
import { transitionStatusMapping } from "../presence/index.js";

/** The data attributes a popup's Positioner, Popup and Arrow render. */
export const PopupDataAttributes = {
	/** Present when the popup is open. */
	open: "data-open",
	/** Present when the popup is closed. */
	closed: "data-closed",
	/** Present when the anchor is hidden. */
	anchorHidden: "data-anchor-hidden",
	/** Indicates which side the popup is positioned relative to the trigger. */
	side: "data-side",
	/** Indicates how the popup is aligned relative to the specified side. */
	align: "data-align",
	/** Present if animations should be instant. */
	instant: "data-instant",
	/** Present when the arrow cannot be centered on the anchor. */
	uncentered: "data-uncentered",
} as const;

/** The data attributes a popup's trigger renders. */
export const PopupTriggerDataAttributes = {
	/** Present when the corresponding popup is open. */
	popupOpen: "data-popup-open",
	/** Present when the trigger is pressed. */
	pressed: "data-pressed",
	/** Present when the trigger is disabled. */
	disabled: "data-disabled",
} as const;

const OPEN = { [PopupDataAttributes.open]: "" };
const CLOSED = { [PopupDataAttributes.closed]: "" };
const ANCHOR_HIDDEN = { [PopupDataAttributes.anchorHidden]: "" };
const POPUP_OPEN = { [PopupTriggerDataAttributes.popupOpen]: "" };
const PRESSED_POPUP_OPEN = { ...POPUP_OPEN, [PopupTriggerDataAttributes.pressed]: "" };

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

/** A trigger's `open` → `data-popup-open` while the popup is open from it. */
export const popupTriggerStateMapping = {
	open(value: boolean): Record<string, string> | null {
		return value ? POPUP_OPEN : null;
	},
} satisfies StateAttributesMapping<{ open: boolean }>;

/** {@link popupTriggerStateMapping} with `data-pressed`, for a trigger whose press opened the popup. */
export const pressedPopupTriggerStateMapping = {
	open(value: boolean): Record<string, string> | null {
		return value ? PRESSED_POPUP_OPEN : null;
	},
} satisfies StateAttributesMapping<{ open: boolean }>;
