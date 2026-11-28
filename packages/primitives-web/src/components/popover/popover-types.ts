import type {
	PopoverArrowState,
	PopoverBackdropState,
	PopoverCloseState,
	PopoverDescriptionState,
	PopoverHandle,
	PopoverPopupState,
	PopoverPortalState,
	PopoverPositionerState,
	PopoverRootChangeEventDetails as PlatformPopoverRootChangeEventDetails,
	PopoverRootChangeEventReason,
	PopoverRootState,
	PopoverTitleState,
	PopoverTriggerState,
	PopoverViewportState,
} from "@sohedra/primitives-core/popover";
import type { Component, ComponentInternals, Snippet, SvelteComponent } from "svelte";
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements";

import type { FocusTarget } from "../../foundation/focus/index.js";
import type {
	ConstructorOptions,
	NativeButtonProps,
	SohedraComponentProps,
	WebTypes,
} from "../../foundation/kernel/index.js";
import type { PortalContainer } from "../../foundation/portal/index.js";
import type {
	Align,
	Boundary,
	CollisionAvoidance,
	OffsetFunction,
	Padding,
	PositionerAnchor,
	Side,
} from "../../foundation/position/index.js";

export type {
	PopoverArrowState,
	PopoverBackdropState,
	PopoverCloseState,
	PopoverDescriptionState,
	PopoverHandle,
	PopoverPopupState,
	PopoverPortalState,
	PopoverPositionerState,
	PopoverRootChangeEventReason,
	PopoverRootState,
	PopoverTitleState,
	PopoverTriggerState,
	PopoverViewportState,
};

/** The details of an open change: why and how it happened, and `cancel()` to refuse it. */
export type PopoverRootChangeEventDetails = PlatformPopoverRootChangeEventDetails<WebTypes>;

/** The props of Popover.Root. */
export interface PopoverRootProps<Payload = unknown> {
	/**
	 * Whether the popover is initially open.
	 *
	 * To render a controlled popover, use the `open` prop instead.
	 * @default false
	 */
	defaultOpen?: boolean | undefined;
	/** Whether the popover is currently open (`bind:open`). */
	open?: boolean | undefined;
	/** Event handler called when the popover is opened or closed. */
	onOpenChange?: ((open: boolean, eventDetails: PopoverRootChangeEventDetails) => void) | undefined;
	/** Event handler called after any animations complete when the popover is opened or closed. */
	onOpenChangeComplete?: ((open: boolean) => void) | undefined;
	/**
	 * Determines if the popover enters a modal state when open.
	 * - `true`: user interaction is limited to the popover: document page scroll is locked, and
	 *   pointer interactions on outside elements are disabled.
	 * - `false`: user interaction with the rest of the document is allowed.
	 * - `'trap-focus'`: focus is trapped inside the popover, but document page scroll is not locked
	 *   and pointer interactions outside of it remain enabled.
	 *
	 * When `modal` is `true`, focus trapping is enabled only if `<Popover.Close>` is rendered
	 * inside `<Popover.Popup>`.
	 * @default false
	 */
	modal?: boolean | "trap-focus" | undefined;
	/**
	 * ID of the trigger that the popover is associated with.
	 * This is useful in conjunction with the `open` prop to create a controlled popover.
	 */
	triggerId?: string | null | undefined;
	/**
	 * ID of the trigger that the popover is associated with.
	 * This is useful in conjunction with the `defaultOpen` prop to create an initially open popover.
	 */
	defaultTriggerId?: string | null | undefined;
	/**
	 * A handle to associate the popover with a trigger.
	 * If specified, allows external triggers to control the popover's open state.
	 */
	handle?: PopoverHandle<Payload> | undefined;
	/** The content of the popover; receives the `payload` of the active trigger. */
	children?: Snippet<[{ payload: Payload | undefined }]> | undefined;
}

/** The imperative actions on `bind:this` of a Popover.Root. */
export interface PopoverRootActions {
	/**
	 * Ends the closing phase of the popover after an externally controlled closing animation
	 * finishes. Call `preventUnmountOnClose()` in `onOpenChange` first.
	 */
	unmount: () => void;
	/** Closes the popover. */
	close: () => void;
}

/**
 * Popover.Root as a component type, generic over the payload (named here so the package's type
 * declarations can refer to it). The construct signature is the one svelte-check reads to infer
 * `Payload` from the props, so the `children` snippet gets the handle's payload type.
 */
export interface PopoverRootComponent {
	new <Payload = unknown>(
		options: ConstructorOptions<PopoverRootProps<Payload>>,
	): SvelteComponent<PopoverRootProps<Payload>> & { $$bindings?: "open" } & PopoverRootActions;
	<Payload = unknown>(
		this: void,
		internals: ComponentInternals,
		props: PopoverRootProps<Payload>,
	): ReturnType<Component<PopoverRootProps<Payload>, PopoverRootActions>>;
	/** The custom element class, as Svelte's `Component` type declares it. */
	element?: typeof HTMLElement;
	/** The bindable props, as Svelte's `Component` type declares them. */
	z_$$bindings?: "open";
}

/** Popover.Trigger as a component type, generic over the payload. */
export interface PopoverTriggerComponent {
	new <Payload = unknown>(
		options: ConstructorOptions<PopoverTriggerProps<Payload>>,
	): SvelteComponent<PopoverTriggerProps<Payload>> & { $$bindings?: "ref" };
	<Payload = unknown>(
		this: void,
		internals: ComponentInternals,
		props: PopoverTriggerProps<Payload>,
	): ReturnType<Component<PopoverTriggerProps<Payload>>>;
	/** The custom element class, as Svelte's `Component` type declares it. */
	element?: typeof HTMLElement;
	/** The bindable props, as Svelte's `Component` type declares them. */
	z_$$bindings?: "ref";
}

/** The props of Popover.Trigger. */
export interface PopoverTriggerProps<Payload = unknown>
	extends
		NativeButtonProps,
		SohedraComponentProps<HTMLButtonAttributes, PopoverTriggerState, HTMLElement> {
	/** A handle to associate the trigger with a popover. */
	handle?: PopoverHandle<Payload> | undefined;
	/** A payload to pass to the popover when it is opened. */
	payload?: Payload | undefined;
	/**
	 * ID of the trigger. In addition to being forwarded to the rendered element, it is also used
	 * to specify the active trigger for the popover in controlled mode (with the Popover.Root
	 * `triggerId` prop).
	 */
	id?: string | undefined;
	/**
	 * Whether the popover should also open when the trigger is hovered.
	 * @default false
	 */
	openOnHover?: boolean | undefined;
	/**
	 * How long to wait before the popover may be opened on hover. Specified in milliseconds.
	 * Requires the `openOnHover` prop.
	 * @default 300
	 */
	delay?: number | undefined;
	/**
	 * How long to wait before closing the popover that was opened on hover. Specified in
	 * milliseconds. Requires the `openOnHover` prop.
	 * @default 0
	 */
	closeDelay?: number | undefined;
	/**
	 * Whether the component should ignore user interaction.
	 * @default false
	 */
	disabled?: boolean | undefined;
}

/** The props of Popover.Portal. */
export interface PopoverPortalProps extends SohedraComponentProps<
	HTMLAttributes<HTMLDivElement>,
	PopoverPortalState,
	HTMLDivElement
> {
	/**
	 * Whether to keep the portal mounted in the DOM while the popup is hidden.
	 * @default false
	 */
	keepMounted?: boolean | undefined;
	/** A parent element to render the portal element into. */
	container?: PortalContainer | undefined;
}

/** The props of Popover.Positioner. */
export interface PopoverPositionerProps extends SohedraComponentProps<
	HTMLAttributes<HTMLDivElement>,
	PopoverPositionerState,
	HTMLDivElement
> {
	/**
	 * An element to position the popup against. By default, the popup is positioned against the
	 * trigger.
	 */
	anchor?: PositionerAnchor | undefined;
	/**
	 * Determines which CSS `position` property to use.
	 * @default 'absolute'
	 */
	positionMethod?: "absolute" | "fixed" | undefined;
	/**
	 * Which side of the anchor element to align the popup against. May automatically change to
	 * avoid collisions.
	 * @default 'bottom'
	 */
	side?: Side | undefined;
	/**
	 * Distance between the anchor and the popup in pixels. Also accepts a function that returns
	 * the distance to read the dimensions of the anchor and positioner elements, along with its
	 * side and alignment.
	 * @default 0
	 */
	sideOffset?: number | OffsetFunction | undefined;
	/**
	 * How to align the popup relative to the specified side.
	 * @default 'center'
	 */
	align?: Align | undefined;
	/**
	 * Additional offset along the alignment axis in pixels. Also accepts a function that returns
	 * the offset to read the dimensions of the anchor and positioner elements, along with its side
	 * and alignment.
	 * @default 0
	 */
	alignOffset?: number | OffsetFunction | undefined;
	/**
	 * An element or a rectangle that delimits the area that the popup is confined to.
	 * @default 'clipping-ancestors'
	 */
	collisionBoundary?: Boundary | undefined;
	/**
	 * Additional space to maintain from the edge of the collision boundary.
	 * @default 5
	 */
	collisionPadding?: Padding | undefined;
	/**
	 * Whether to maintain the popup in the viewport after the anchor element was scrolled out of
	 * view.
	 * @default false
	 */
	sticky?: boolean | undefined;
	/**
	 * Minimum distance to maintain between the arrow and the edges of the popup. Use it to
	 * prevent the arrow element from hanging out of the rounded corners of a popup.
	 * @default 5
	 */
	arrowPadding?: number | undefined;
	/**
	 * Whether to disable the popup from tracking any layout shift of its positioning anchor.
	 * @default false
	 */
	disableAnchorTracking?: boolean | undefined;
	/**
	 * Determines how to handle collisions when positioning the popup.
	 * @default { fallbackAxisSide: 'end' }
	 */
	collisionAvoidance?: CollisionAvoidance | undefined;
}

/** The props of Popover.Popup. */
export interface PopoverPopupProps extends SohedraComponentProps<
	HTMLAttributes<HTMLDivElement>,
	PopoverPopupState,
	HTMLDivElement
> {
	/**
	 * Determines the element to focus when the popover is opened.
	 * By default, focus moves to the first tabbable element inside the popup, except when the
	 * popover is opened by touch: then the popup itself is focused to avoid opening the virtual
	 * keyboard.
	 * - `false`: Do not move focus.
	 * - `true`: Move focus based on the default behavior (first tabbable element or popup).
	 * - an element: Move focus to it.
	 * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
	 *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to
	 *   do nothing.
	 */
	initialFocus?: FocusTarget | undefined;
	/**
	 * Determines the element to focus when the popover is closed.
	 * - `false`: Do not move focus.
	 * - `true`: Move focus based on the default behavior (trigger or previously focused element).
	 * - an element: Move focus to it.
	 * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
	 *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to
	 *   do nothing.
	 */
	finalFocus?: FocusTarget | undefined;
}

/** The props of Popover.Arrow. */
export interface PopoverArrowProps extends SohedraComponentProps<
	HTMLAttributes<HTMLDivElement>,
	PopoverArrowState,
	HTMLDivElement
> {}

/** The props of Popover.Backdrop. */
export interface PopoverBackdropProps extends SohedraComponentProps<
	HTMLAttributes<HTMLDivElement>,
	PopoverBackdropState,
	HTMLDivElement
> {}

/** The props of Popover.Title. */
export interface PopoverTitleProps extends SohedraComponentProps<
	HTMLAttributes<HTMLHeadingElement>,
	PopoverTitleState,
	HTMLHeadingElement
> {}

/** The props of Popover.Description. */
export interface PopoverDescriptionProps extends SohedraComponentProps<
	HTMLAttributes<HTMLParagraphElement>,
	PopoverDescriptionState,
	HTMLParagraphElement
> {}

/** The props of Popover.Close. */
export interface PopoverCloseProps
	extends
		NativeButtonProps,
		SohedraComponentProps<HTMLButtonAttributes, PopoverCloseState, HTMLButtonElement> {
	/**
	 * Whether the button should ignore user interaction.
	 * @default false
	 */
	disabled?: boolean | undefined;
}

/** The props of Popover.Viewport. */
export interface PopoverViewportProps extends SohedraComponentProps<
	HTMLAttributes<HTMLDivElement>,
	PopoverViewportState,
	HTMLDivElement
> {}
