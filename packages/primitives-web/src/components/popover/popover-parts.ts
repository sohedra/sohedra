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

/** Groups all parts of the popover. Doesn't render its own HTML element. */
export const Root: PopoverRootComponent = PopoverRoot;
export declare namespace Root {
	export type State = PopoverRootState;
	export type Props<Payload = unknown> = PopoverRootProps<Payload>;
	export type Actions = PopoverRootActions;
	export type ChangeEventReason = PopoverRootChangeEventReason;
	export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

/** A button that opens the popover. Renders a `<button>` element. */
export const Trigger: PopoverTriggerComponent = PopoverTrigger;
export declare namespace Trigger {
	export type State = PopoverTriggerState;
	export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}

/**
 * A portal element that moves the popup to a different part of the DOM. Renders a `<div>` element.
 */
export const Portal = PopoverPortal;
export declare namespace Portal {
	export type State = PopoverPortalState;
	export type Props = PopoverPortalProps;
}

/** Positions the popover against the trigger. Renders a `<div>` element. */
export const Positioner = PopoverPositioner;
export declare namespace Positioner {
	export type State = PopoverPositionerState;
	export type Props = PopoverPositionerProps;
}

/** A container for the popover contents. Renders a `<div>` element. */
export const Popup = PopoverPopup;
export declare namespace Popup {
	export type State = PopoverPopupState;
	export type Props = PopoverPopupProps;
}

/** Displays an element positioned against the popover anchor. Renders a `<div>` element. */
export const Arrow = PopoverArrow;
export declare namespace Arrow {
	export type State = PopoverArrowState;
	export type Props = PopoverArrowProps;
}

/** An overlay displayed beneath the popover. Renders a `<div>` element. */
export const Backdrop = PopoverBackdrop;
export declare namespace Backdrop {
	export type State = PopoverBackdropState;
	export type Props = PopoverBackdropProps;
}

/** A heading that labels the popover. Renders an `<h2>` element. */
export const Title = PopoverTitle;
export declare namespace Title {
	export type State = PopoverTitleState;
	export type Props = PopoverTitleProps;
}

/** A paragraph with additional information about the popover. Renders a `<p>` element. */
export const Description = PopoverDescription;
export declare namespace Description {
	export type State = PopoverDescriptionState;
	export type Props = PopoverDescriptionProps;
}

/** A button that closes the popover. Renders a `<button>` element. */
export const Close = PopoverClose;
export declare namespace Close {
	export type State = PopoverCloseState;
	export type Props = PopoverCloseProps;
}

/** A viewport for displaying content transitions. Renders a `<div>` element. */
export const Viewport = PopoverViewport;
export declare namespace Viewport {
	export type State = PopoverViewportState;
	export type Props = PopoverViewportProps;
}

export { createPopoverHandle as createHandle, PopoverHandle as Handle };
