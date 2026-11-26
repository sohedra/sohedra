// Switch's styling hooks on the web: the data attributes its parts render, and how state maps to
// them.
import type { StateAttributesMapping } from "../../foundation/kernel/index.js";
import type { SwitchRootState } from "./switch-types.js";

/** The data attributes Switch.Root renders. */
export const SwitchRootDataAttributes = {
	/** Present when the switch is checked. */
	checked: "data-checked",
	/** Present when the switch is not checked. */
	unchecked: "data-unchecked",
	/** Present when the switch is disabled. */
	disabled: "data-disabled",
	/** Present when the switch is readonly. */
	readonly: "data-readonly",
	/** Present when the switch is required. */
	required: "data-required",
	/** Present when the switch is in a valid state (when wrapped in Field.Root). */
	valid: "data-valid",
	/** Present when the switch is in an invalid state (when wrapped in Field.Root). */
	invalid: "data-invalid",
	/** Present when the switch has been touched (when wrapped in Field.Root). */
	touched: "data-touched",
	/** Present when the switch's value has changed (when wrapped in Field.Root). */
	dirty: "data-dirty",
	/** Present when the switch is active (when wrapped in Field.Root). */
	filled: "data-filled",
	/** Present when the switch is focused (when wrapped in Field.Root). */
	focused: "data-focused",
} as const;

/** The data attributes Switch.Thumb renders: the same as the root's. */
export const SwitchThumbDataAttributes = SwitchRootDataAttributes;

/** Switch state → data attributes, for both parts. */
export const switchAttributes: StateAttributesMapping<SwitchRootState> = {
	checked(value): Record<string, string> {
		return value
			? { [SwitchRootDataAttributes.checked]: "" }
			: { [SwitchRootDataAttributes.unchecked]: "" };
	},
	// Field validity: absent until validated, then data-valid or data-invalid.
	valid(value): Record<string, string> | null {
		if (value === null) {
			return null;
		}
		return value
			? { [SwitchRootDataAttributes.valid]: "" }
			: { [SwitchRootDataAttributes.invalid]: "" };
	},
};
