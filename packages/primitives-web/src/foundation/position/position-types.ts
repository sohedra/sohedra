import type { Middleware, Padding, VirtualElement } from "@floating-ui/dom";
import type { TriggerChangeWait } from "@sohedra/primitives-core/foundation/popup/index.js";
import type {
	Align,
	CollisionAvoidance,
	OffsetFunction,
	PositionerStore,
	Side,
} from "@sohedra/primitives-core/foundation/position/index.js";
import type { TransitionStatus } from "@sohedra/primitives-core/foundation/presence/index.js";
import type { Attachment } from "svelte/attachments";

import type { WebTypes } from "../kernel/index.js";
import type { PopupLayoutState } from "./position-popup-layout.svelte.js";
import type { Boundary, ShiftOptions } from "./position-positioner-middleware.js";

/** An anchor: an element, a virtual element, or a function returning one. */
export type PositionerAnchor =
	| Element
	| VirtualElement
	| null
	| (() => Element | VirtualElement | null);

/**
 * Everything positioning reads from a popup, and the one thing it asks of it. The names are a
 * popup store's own, so a part hands its store over as it is; the behaviour can reach nothing
 * else of it.
 */
export interface PositionerView {
	/** Whether the popup is in the document: open, or closing. */
	readonly mounted: boolean;
	/** The element the popup is anchored to, unless the part gives an `anchor`. */
	readonly anchorElement: Element | null;
	/** The Positioner part's element. */
	readonly positionerElement: Element | null;
	/** The active trigger's element: what a modal popup's backdrop leaves pressable. */
	readonly activeTriggerElement: Element | null;
	/** The popup's active trigger. */
	readonly activeTrigger: {
		/** A kept-mounted popup that closed forgets the element it was anchored to. */
		clearDomReference(): void;
	};
}

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
	readonly layout?: PopupLayoutState | undefined;
	/** Positions against one line box of a wrapped anchor (a preview card's link). */
	readonly inline?: Middleware | undefined;
	/** Whether the Positioner lets pointer input through (`pointer-events: none`). */
	readonly inert?: boolean | undefined;
	/**
	 * Keeps a flipped placement while mounted, so content resizing the popup doesn't flip it back:
	 * `true` keeps the side, `'placement'` the alignment too. @default false
	 */
	readonly lazyFlip?: boolean | "placement" | undefined;
	/** Overrides the shift collision avoidance sets up (a context menu's). */
	readonly shift?: ShiftOptions | undefined;
	/**
	 * The element cut out of the internal backdrop, so it stays pressable (a menubar's menu cuts out
	 * the menubar). The active trigger when not given.
	 */
	readonly backdropCutout?: Element | null | undefined;
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

/**
 * Everything the shared Positioner part reads from a popup, and what it asks of it: the
 * positioning's own view and what the part renders with. The names are a popup store's own.
 */
export interface AnchoredPositionerView extends PositionerView {
	readonly open: boolean;
	readonly transitionStatus: TransitionStatus;
	/** Whether the Positioner lets pointer input through. */
	readonly positionerIgnoresPointer: boolean;
	/** The popup reads this Positioner's measured state while it is mounted. */
	readonly positionerClaim: {
		claim(token: object, value: PositionerStore<WebTypes>): () => void;
	};
	setPositionerElement(element: HTMLElement | null): void;
}

export interface Positioner {
	/** Goes on the Positioner element: positions it while the popup is mounted. */
	readonly attach: Attachment<HTMLElement>;
	/** The Positioner element's inline style (position, transform and CSS variables). */
	readonly style: string;
	/** The internal backdrop's inline style, with the active trigger (or the cutout) cut out. */
	readonly backdropStyle: string;
}

/** Everything a Viewport reads from a popup. The names are a popup store's own. */
export interface ViewportView {
	readonly open: boolean;
	readonly mounted: boolean;
	readonly activeTriggerId: string | null;
	readonly activeTriggerElement: Element | null;
	/** The active trigger's payload; compared by identity only. */
	readonly payload: unknown;
	/** The Popup part's element, which the Viewport measures. */
	readonly popupElement: Element | null;
	readonly positionerElement: Element | null;
}

/** A Viewport's options, as a plain object the part builds from its Positioner. */
export interface ViewportOptions {
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

/**
 * What the trigger-switch transition reads from a popup: the element whose animations it waits
 * for, and the lifecycle that decides when the popup moved. The names are a popup store's own.
 */
export interface TriggerSwitchView {
	readonly positionerElement: Element | null;
	readonly lifecycle: { connectTriggerChange(waitForMove: TriggerChangeWait): void };
}

export interface AnchoredScrollLockOptions {
	readonly enabled: boolean;
	/** Whether the popup was opened by touch: then it locks only when it spans the viewport. */
	readonly touchOpen: boolean;
	readonly positionerElement: HTMLElement | null;
	readonly referenceElement: Element | null;
}
