// The package entry: every component's exports by name, one statement per component, then the
// shared types the components' public props and state use, one statement per job that holds them.
export {
	Popover,
	PopoverArrowDataAttributes,
	type PopoverArrowProps,
	type PopoverArrowState,
	PopoverBackdropDataAttributes,
	type PopoverBackdropProps,
	type PopoverBackdropState,
	type PopoverCloseProps,
	type PopoverCloseState,
	type PopoverDescriptionProps,
	type PopoverDescriptionState,
	type PopoverHandle,
	PopoverPopupCssVariables,
	PopoverPopupDataAttributes,
	type PopoverPopupProps,
	type PopoverPopupState,
	type PopoverPortalProps,
	type PopoverPortalState,
	PopoverPositionerCssVariables,
	PopoverPositionerDataAttributes,
	type PopoverPositionerProps,
	type PopoverPositionerState,
	type PopoverRootActions,
	type PopoverRootChangeEventDetails,
	type PopoverRootChangeEventReason,
	type PopoverRootComponent,
	type PopoverRootProps,
	type PopoverRootState,
	type PopoverTitleProps,
	type PopoverTitleState,
	type PopoverTriggerComponent,
	PopoverTriggerDataAttributes,
	type PopoverTriggerProps,
	type PopoverTriggerState,
	PopoverViewportCssVariables,
	PopoverViewportDataAttributes,
	type PopoverViewportProps,
	type PopoverViewportState,
} from "./components/popover/index.js";
export {
	Switch,
	type SwitchRootChangeEventDetails,
	type SwitchRootChangeEventReason,
	SwitchRootDataAttributes,
	type SwitchRootProps,
	type SwitchRootState,
	SwitchThumbDataAttributes,
	type SwitchThumbProps,
	type SwitchThumbState,
} from "./components/switch/index.js";
export type {
	InstantType,
	InteractionType,
} from "@sohedra/primitives-core/foundation/popup/index.js";
export type { TransitionStatus } from "@sohedra/primitives-core/foundation/presence/index.js";
export type { FocusTarget } from "./foundation/focus/index.js";
export type { PortalContainer } from "./foundation/portal/index.js";
export type {
	Align,
	Boundary,
	CollisionAvoidance,
	OffsetFunction,
	Padding,
	PositionerAnchor,
	Side,
} from "./foundation/position/index.js";
