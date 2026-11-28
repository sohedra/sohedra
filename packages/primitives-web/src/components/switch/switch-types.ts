import type {
	SwitchRootChangeEventDetails as PlatformSwitchRootChangeEventDetails,
	SwitchRootChangeEventReason,
	SwitchRootState,
	SwitchThumbState,
} from "@sohedra/primitives-core/components/switch/index.js";
import type { HTMLAttributes } from "svelte/elements";

import type {
	NonNativeButtonProps,
	SohedraComponentProps,
	WebTypes,
} from "../../foundation/kernel/index.js";

export type { SwitchRootChangeEventReason, SwitchRootState, SwitchThumbState };

export type SwitchRootChangeEventDetails = PlatformSwitchRootChangeEventDetails<WebTypes>;

export interface SwitchRootProps
	extends
		NonNativeButtonProps,
		Omit<SohedraComponentProps<HTMLAttributes<HTMLSpanElement>, SwitchRootState>, "onchange"> {
	/**
	 * The id of the hidden input element.
	 *
	 * When `nativeButton` is `true`, the id is applied to the root element.
	 */
	id?: string | undefined;
	/**
	 * Whether the switch is currently active (`bind:checked`).
	 *
	 * To render an uncontrolled switch, use the `defaultChecked` prop instead.
	 */
	checked?: boolean | undefined;
	/**
	 * Whether the switch is initially active.
	 *
	 * To render a controlled switch, use the `checked` prop instead.
	 * @default false
	 */
	defaultChecked?: boolean | undefined;
	/**
	 * Whether the component should ignore user interaction.
	 * @default false
	 */
	disabled?: boolean | undefined;
	/** The hidden `<input>` element (`bind:inputRef`). */
	inputRef?: HTMLInputElement | null | undefined;
	/** Identifies the field when a form is submitted. */
	name?: string | undefined;
	/**
	 * Identifies the form that owns the hidden input.
	 * Useful when the switch is rendered outside the form.
	 */
	form?: string | undefined;
	/** Event handler called when the switch is activated or deactivated. */
	onCheckedChange?:
		| ((checked: boolean, eventDetails: SwitchRootChangeEventDetails) => void)
		| undefined;
	/**
	 * Whether the user should be unable to activate or deactivate the switch.
	 * @default false
	 */
	readOnly?: boolean | undefined;
	/**
	 * Whether the user must activate the switch before submitting a form.
	 * @default false
	 */
	required?: boolean | undefined;
	/**
	 * The value submitted with the form when the switch is on.
	 * By default, switch submits the "on" value, matching native checkbox behavior.
	 */
	value?: string | undefined;
	/**
	 * The value submitted with the form when the switch is off.
	 * By default, unchecked switches do not submit any value, matching native checkbox behavior.
	 */
	uncheckedValue?: string | undefined;
}

export interface SwitchThumbProps extends SohedraComponentProps<
	HTMLAttributes<HTMLSpanElement>,
	SwitchThumbState,
	HTMLSpanElement
> {}
