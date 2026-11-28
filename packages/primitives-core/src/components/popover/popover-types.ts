import type { ChangeEventDetails, PlatformTypes, REASONS } from "../../foundation/kernel/index.js";
import type { InstantType } from "../../foundation/popup/index.js";
import type { Align, Side } from "../../foundation/position/index.js";
import type { TransitionStatus } from "../../foundation/presence/index.js";

export interface PopoverRootState {}

export type PopoverRootChangeEventReason =
	| typeof REASONS.triggerHover
	| typeof REASONS.triggerFocus
	| typeof REASONS.triggerPress
	| typeof REASONS.outsidePress
	| typeof REASONS.escapeKey
	| typeof REASONS.closePress
	| typeof REASONS.focusOut
	| typeof REASONS.imperativeAction
	| typeof REASONS.none;

export type PopoverRootChangeEventDetails<T extends PlatformTypes> = ChangeEventDetails<
	PopoverRootChangeEventReason | T["reasons"],
	{
		/** Prevents the popup from unmounting until the `unmount` action is called. */
		preventUnmountOnClose: () => void;
	},
	T
>;

export interface PopoverTriggerState {
	/** Whether the trigger is currently disabled. */
	disabled: boolean;
	/** Whether the popover is currently open and was opened by this trigger. */
	open: boolean;
}

export interface PopoverPortalState {}

export interface PopoverPositionerState {
	/** Whether the popover is currently open. */
	open: boolean;
	/** The side of the anchor the component is placed on. */
	side: Side;
	/** The alignment of the component relative to the anchor. */
	align: Align;
	/** Whether the anchor element is hidden. */
	anchorHidden: boolean;
	/** Whether CSS transitions should be disabled. */
	instant: InstantType;
}

export interface PopoverPopupState {
	/** Whether the popover is currently open. */
	open: boolean;
	/** The side of the anchor the component is placed on. */
	side: Side;
	/** The alignment of the component relative to the anchor. */
	align: Align;
	/** The transition status of the component. */
	transitionStatus: TransitionStatus;
	/** Whether transitions should be skipped. */
	instant: InstantType;
}

export interface PopoverArrowState {
	/** Whether the popover is currently open. */
	open: boolean;
	/** The side of the anchor the component is placed on. */
	side: Side;
	/** The alignment of the component relative to the anchor. */
	align: Align;
	/** Whether the arrow cannot be centered on the anchor. */
	uncentered: boolean;
}

export interface PopoverBackdropState {
	/** Whether the popover is currently open. */
	open: boolean;
	/** The transition status of the component. */
	transitionStatus: TransitionStatus;
}

export interface PopoverTitleState {}
export interface PopoverDescriptionState {}
export interface PopoverCloseState {}

export interface PopoverViewportState {
	/** The direction the content moved in when the active trigger changed. */
	activationDirection: string | undefined;
	/** Whether the viewport is transitioning between contents. */
	transitioning: boolean;
	/** Whether transitions should be skipped. */
	instant: InstantType;
}
