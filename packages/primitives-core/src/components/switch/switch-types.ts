import type { FieldRootState } from "../../foundation/form/index.js";
import type { ChangeEventDetails, PlatformTypes, REASONS } from "../../foundation/kernel/index.js";

/** The state of Switch.Root, which its `render` snippet, `class` and `style` receive. */
export interface SwitchRootState extends FieldRootState {
	/** Whether the switch is currently active. */
	checked: boolean;
	/** Whether the component should ignore user interaction. */
	disabled: boolean;
	/** Whether the user should be unable to activate or deactivate the switch. */
	readOnly: boolean;
	/** Whether the user must activate the switch before submitting a form. */
	required: boolean;
}

/** Switch.Thumb's state: the same as the root's. */
export interface SwitchThumbState extends SwitchRootState {}

/** Why the switch changed. */
export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails<T extends PlatformTypes> = ChangeEventDetails<
	SwitchRootChangeEventReason | T["reasons"],
	{},
	T
>;
