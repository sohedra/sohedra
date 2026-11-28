// Popover's store, rules, handle and types, as the platforms import them.
export { createPopoverHandle, PopoverHandle } from "./popover-handle.js";
export {
	closeTakesActiveTrigger,
	isTouchPressOpen,
	OPEN_DELAY,
	PATIENT_CLICK_THRESHOLD,
	popoverArrowState,
	popoverInstantType,
	popoverOutsidePress,
	popoverPopupState,
	triggerHasFocusGuards,
} from "./popover-rules.js";
export {
	type ClosePartCount,
	type PopoverOpenChangeSource,
	PopoverStore,
	type PopoverStoreDeps,
	type PopoverStoreProps,
	type PopoverTriggerData,
} from "./popover-store.svelte.js";
export type {
	PopoverArrowState,
	PopoverBackdropState,
	PopoverCloseState,
	PopoverDescriptionState,
	PopoverPopupState,
	PopoverPortalState,
	PopoverPositionerState,
	PopoverRootChangeEventDetails,
	PopoverRootChangeEventReason,
	PopoverRootState,
	PopoverTitleState,
	PopoverTriggerState,
	PopoverViewportState,
} from "./popover-types.js";
