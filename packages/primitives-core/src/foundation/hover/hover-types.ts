// What the hover behaviour reads of a popup, and the event and details of a hover change.

import type {
	ChangeEventDetails,
	InteractionEventType,
	PlatformEvent,
	PlatformTypes,
	REASONS,
	Scheduler,
} from "../kernel/index.js";
import type { PopupTree, OpenChangeSource } from "../popup/index.js";
import type { PhysicalSide } from "../position/index.js";
import type { TransitionStatus } from "../presence/index.js";
import type { HoverInteraction } from "./hover-interaction.js";

/** The platform's event for a hover change (web: a `MouseEvent`). */
export type HoverEvent<T extends PlatformTypes> = PlatformEvent<T, typeof REASONS.triggerHover>;

/** The change details a hover open or close carries. */
export type HoverChangeDetails<T extends PlatformTypes> = ChangeEventDetails<
	typeof REASONS.triggerHover,
	{},
	T
>;

/**
 * Everything the hover behaviour reads from a popup, and the one thing it asks of it. The names
 * are a popup store's own, so a store whose kind opens on hover is handed over as it is; the
 * behaviour can reach nothing else of it.
 */
export interface HoverView<T extends PlatformTypes = PlatformTypes> {
	readonly open: boolean;
	/** `ending` while the popup's close transition runs. */
	readonly transitionStatus: TransitionStatus;
	/** The popup's hover state: its timers, its pointer and the active safe polygon. */
	readonly hover: HoverInteraction<T>;
	/** The tree of nested popups: an open child keeps its parent open. */
	readonly tree: PopupTree<T> | null;
	/** The popup's node in {@link tree}. */
	readonly nodeId: string | undefined;
	/** The kind of event that opened the popup: a hover never closes a click-opened one. */
	readonly openEventType: InteractionEventType | undefined;
	/** The element the popup is anchored to: its owning trigger. */
	readonly anchorElement: T["element"] | null;
	/** The mounted Positioner's measured state: its side is the safe polygon's. */
	readonly positionerClaim: {
		readonly current:
			| { readonly position: { readonly physicalSide: PhysicalSide } }
			| null
			| undefined;
	};
	readonly platform: { readonly scheduler: Scheduler };
	/** Opens or closes the popup. The behaviour only ever passes hover details. */
	setOpen(open: boolean, details: HoverChangeDetails<T>, source?: OpenChangeSource): void;
}

/** What the nested-popup checks read of a popup. */
export type HoverTreeView<T extends PlatformTypes> = Pick<HoverView<T>, "tree" | "nodeId">;
