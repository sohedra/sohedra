import type { Padding, VirtualElement } from "@floating-ui/dom";
import type {
	Align,
	AnchoredViewportState,
	CollisionAvoidance,
	OffsetFunction,
	Side,
} from "@sohedra/primitives-core/foundation/position/index.js";
import type { HTMLAttributes } from "svelte/elements";

import type { Props } from "../kernel/index.js";
import type { PopupLayoutStore } from "../popup/index.js";
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
	/**
	 * For the Positioner element: as an attachment inside, its positioning while the popup is
	 * mounted.
	 */
	readonly props: Props;
	/** The Positioner element's inline style (position, transform and CSS variables). */
	readonly style: string;
	/** The internal backdrop's inline style, with the active trigger (or the cutout) cut out. */
	readonly backdropStyle: string;
}

/** A Viewport's options, as a plain object the part builds from its Positioner. */
export interface ViewportOptions {
	/** The side the enclosing Positioner placed the popup on. */
	readonly side: Side;
}

export interface Viewport {
	/** The Viewport part's state, from its content store in core. */
	readonly state: AnchoredViewportState;
	/** Changes when the content has to be created anew: the part keys its content on it. */
	readonly contentKey: number;
	/** Whether the current content shows its starting style. */
	readonly showStartingStyle: boolean;
	/** The inline style of the container that shows the previous content. */
	readonly previousStyle: string;
	/** For the container of the current content. It holds an attachment. */
	readonly current: HTMLAttributes<HTMLDivElement>;
	/** For the container of the previous content. It holds an attachment. */
	readonly previous: HTMLAttributes<HTMLDivElement>;
}

export interface AnchoredScrollLockOptions {
	readonly enabled: boolean;
	/** Whether the popup was opened by touch: then it locks only when it spans the viewport. */
	readonly touchOpen: boolean;
	readonly positionerElement: HTMLElement | null;
	readonly triggerElement: Element | null;
}
