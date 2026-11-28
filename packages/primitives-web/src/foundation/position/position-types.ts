import type { Padding, VirtualElement } from "@floating-ui/dom";
import type {
	Align,
	CollisionAvoidance,
	OffsetFunction,
	Side,
} from "@sohedra/primitives-core/foundation/position/index.js";
import type { Attachment } from "svelte/attachments";

import type { PopupLayoutStore } from "./position-popup-layout.svelte.js";
import type { Boundary } from "./position-positioner-middleware.js";

/** An anchor: an element, a virtual element, or a function returning one. */
export type PositionerAnchor =
	| Element
	| VirtualElement
	| null
	| (() => Element | VirtualElement | null);

/** A Positioner's placement options, as a plain object the part builds from its props. */
export interface PositionerOptions {
	readonly anchor?: PositionerAnchor | undefined;
	readonly positionMethod?: "absolute" | "fixed" | undefined;
	readonly side?: Side | undefined;
	readonly sideOffset?: number | OffsetFunction | undefined;
	readonly align?: Align | undefined;
	readonly alignOffset?: number | OffsetFunction | undefined;
	readonly collisionBoundary?: Boundary | undefined;
	readonly collisionPadding?: Padding | undefined;
	readonly sticky?: boolean | undefined;
	readonly arrowPadding?: number | undefined;
	readonly disableAnchorTracking?: boolean | undefined;
	readonly collisionAvoidance: CollisionAvoidance;
	readonly keepMounted: boolean;
	readonly rtl: boolean;
	/** The layout a Viewport inside measures (sizes, far-edge placement). */
	readonly layout?: PopupLayoutStore | undefined;
	/** Whether the Positioner lets pointer input through (`pointer-events: none`). */
	readonly inert?: boolean | undefined;
}

/** The placement props a user sets on a component's Positioner part. */
export type AnchoredPositionerPlacement = Partial<
	Pick<
		PositionerOptions,
		| "anchor"
		| "positionMethod"
		| "side"
		| "sideOffset"
		| "align"
		| "alignOffset"
		| "collisionBoundary"
		| "collisionPadding"
		| "sticky"
		| "arrowPadding"
		| "disableAnchorTracking"
		| "collisionAvoidance"
	>
>;

export interface Positioner {
	/** Goes on the Positioner element: positions it while the popup is mounted. */
	readonly attach: Attachment<HTMLElement>;
	/** The Positioner element's inline style (position, transform and CSS variables). */
	readonly style: string;
	/** The internal backdrop's inline style, with the active trigger (or the cutout) cut out. */
	readonly backdropStyle: string;
}

/** A Viewport's options, as a plain object the part builds from its Positioner. */
export interface ViewportOptions {
	/** The Viewport part's public name, for the error outside a Positioner. Read once. */
	readonly part: string;
	/** The side the enclosing Positioner placed the popup on. */
	readonly side: Side;
}

export interface Viewport {
	/** Changes when the content has to be created anew: the part keys its content on it. */
	readonly contentKey: number;
	/** Whether the previous content is still on its way out. */
	readonly transitioning: boolean;
	/** The tokens of `data-activation-direction`. */
	readonly activationDirection: string | undefined;
	/** Whether the current content shows its starting style. */
	readonly showStartingStyle: boolean;
	/** The inline style of the container that shows the previous content. */
	readonly previousStyle: string;
	/** Goes on the container of the current content. */
	readonly attachCurrent: Attachment<HTMLElement>;
	/** Goes on the container of the previous content. */
	readonly attachPrevious: Attachment<HTMLElement>;
}

export interface AnchoredScrollLockOptions {
	readonly enabled: boolean;
	/** Whether the popup was opened by touch: then it locks only when it spans the viewport. */
	readonly touchOpen: boolean;
	readonly positionerElement: HTMLElement | null;
	readonly triggerElement: Element | null;
}
