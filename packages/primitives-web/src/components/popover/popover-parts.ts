import { createPopoverHandle, PopoverHandle } from "@sohedra/primitives-core/popover";

import PopoverArrow from "./popover-arrow.svelte";
import PopoverBackdrop from "./popover-backdrop.svelte";
import PopoverClose from "./popover-close.svelte";
import PopoverDescription from "./popover-description.svelte";
import PopoverPopup from "./popover-popup.svelte";
import PopoverPortal from "./popover-portal.svelte";
import PopoverPositioner from "./popover-positioner.svelte";
import PopoverRoot from "./popover-root.svelte";
import PopoverTitle from "./popover-title.svelte";
import PopoverTrigger from "./popover-trigger.svelte";
import type {
	PopoverArrowProps,
	PopoverArrowState,
	PopoverBackdropProps,
	PopoverBackdropState,
	PopoverCloseProps,
	PopoverCloseState,
	PopoverDescriptionProps,
	PopoverDescriptionState,
	PopoverPopupProps,
	PopoverPopupState,
	PopoverPortalProps,
	PopoverPortalState,
	PopoverPositionerProps,
	PopoverPositionerState,
	PopoverRootActions,
	PopoverRootChangeEventDetails,
	PopoverRootChangeEventReason,
	PopoverRootComponent,
	PopoverRootProps,
	PopoverRootState,
	PopoverTitleProps,
	PopoverTitleState,
	PopoverTriggerComponent,
	PopoverTriggerProps,
	PopoverTriggerState,
	PopoverViewportProps,
	PopoverViewportState,
} from "./popover-types.js";
import PopoverViewport from "./popover-viewport.svelte";

export const Root: PopoverRootComponent = PopoverRoot;
export declare namespace Root {
	export type State = PopoverRootState;
	export type Props<Payload = unknown> = PopoverRootProps<Payload>;
	export type Actions = PopoverRootActions;
	export type ChangeEventReason = PopoverRootChangeEventReason;
	export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

export const Trigger: PopoverTriggerComponent = PopoverTrigger;
export declare namespace Trigger {
	export type State = PopoverTriggerState;
	export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}

export const Portal = PopoverPortal;
export declare namespace Portal {
	export type State = PopoverPortalState;
	export type Props = PopoverPortalProps;
}

export const Positioner = PopoverPositioner;
export declare namespace Positioner {
	export type State = PopoverPositionerState;
	export type Props = PopoverPositionerProps;
}

export const Popup = PopoverPopup;
export declare namespace Popup {
	export type State = PopoverPopupState;
	export type Props = PopoverPopupProps;
}

export const Arrow = PopoverArrow;
export declare namespace Arrow {
	export type State = PopoverArrowState;
	export type Props = PopoverArrowProps;
}

export const Backdrop = PopoverBackdrop;
export declare namespace Backdrop {
	export type State = PopoverBackdropState;
	export type Props = PopoverBackdropProps;
}

export const Title = PopoverTitle;
export declare namespace Title {
	export type State = PopoverTitleState;
	export type Props = PopoverTitleProps;
}

export const Description = PopoverDescription;
export declare namespace Description {
	export type State = PopoverDescriptionState;
	export type Props = PopoverDescriptionProps;
}

export const Close = PopoverClose;
export declare namespace Close {
	export type State = PopoverCloseState;
	export type Props = PopoverCloseProps;
}

export const Viewport = PopoverViewport;
export declare namespace Viewport {
	export type State = PopoverViewportState;
	export type Props = PopoverViewportProps;
}

export { createPopoverHandle as createHandle, PopoverHandle as Handle };
