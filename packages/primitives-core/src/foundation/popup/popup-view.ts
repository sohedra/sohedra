// What a popup's interactions and wirings read of a popup and ask of it, on every platform: one
// view, which a popup store satisfies as it is. A building block that reads less names the
// members it reads (`Pick<PopupView<T>, …>`).

import type { DismissInteraction } from "../dismiss/index.js";
import type { TriggerFocusGuards } from "../focus/index.js";
import type { HoverInteraction } from "../hover/index.js";
import type {
	AnyPlatformEvent,
	ChangeEventDetails,
	ClaimedValue,
	InteractionEventType,
	PlatformTypes,
	Scheduler,
} from "../kernel/index.js";
import type { PositionerStore } from "../position/index.js";
import type { TransitionStatus } from "../presence/index.js";
import type { ActiveTriggerStore } from "./popup-active-trigger-store.svelte.js";
import type { PopupBehavior } from "./popup-behavior.js";
import type { EventEmitter } from "./popup-event-emitter.js";
import type { PopupTree } from "./popup-tree.js";
import type { PopupTriggerMap } from "./popup-trigger-map.js";
import type {
	InteractionType,
	OpenChangeSource,
	PopupEvents,
	PopupTriggerData,
} from "./popup-types.js";

/**
 * Everything a popup's interactions and wirings read of a popup, and what they ask of it. The
 * names are a popup store's own, so a part hands its store over as it is; the kind's answers
 * (the focus manager's, hover's, the scroll lock's) are the store's live answers for its kind.
 */
export interface PopupView<T extends PlatformTypes = PlatformTypes> {
	// The popup's kind and place
	/** The kind's row of the behaviour table: which interactions its parts wire. */
	readonly behavior: PopupBehavior;
	/** The tree of nested popups: an open child keeps its parent open and answers first. */
	readonly tree: PopupTree<T> | null;
	/** The popup's node in {@link tree}. */
	readonly nodeId: string | undefined;
	readonly platform: { readonly scheduler: Scheduler };
	/** Whether Escape and outside presses inside the popup also reach its ancestors. */
	readonly dismissBubbles: { readonly escapeKey: boolean; readonly outsidePress: boolean };

	// Open state
	readonly open: boolean;
	/** Whether the popup is in the document: open, or closing. */
	readonly mounted: boolean;
	/** `ending` while the popup's close transition runs. */
	readonly transitionStatus: TransitionStatus;
	/** Whether a closed popup is waiting for its exit animations before unmounting. */
	readonly awaitingUnmount: boolean;
	/** How the popup was opened, while it is open. */
	readonly openMethod: InteractionType | null;
	/** The event that opened the popup. */
	readonly openEvent: AnyPlatformEvent<T> | undefined;
	/** The kind of event that opened the popup: a hover never closes a click-opened one. */
	readonly openEventType: InteractionEventType | undefined;
	/** The popup's open changes, with the reason and the event of each. */
	readonly events: EventEmitter<PopupEvents<T>>;

	// Elements and triggers
	/** The Popup part's element. */
	readonly popupElement: T["element"] | null;
	/** The Positioner's element: the positioned element that holds the popup. */
	readonly positionerElement: T["element"] | null;
	/** The element the popup is anchored to and returns focus to: its owning trigger. */
	readonly anchorElement: T["element"] | null;
	/** The id of the trigger the popup belongs to. */
	readonly activeTriggerId: string | null;
	/** The active trigger element, while the popup is mounted. */
	readonly activeTriggerElement: T["element"] | null;
	/** Which registered trigger the popup belongs to. */
	readonly activeTrigger: ActiveTriggerStore<T>;
	/** The popup's registered triggers. */
	readonly triggers: PopupTriggerMap<T>;
	/** The active trigger's payload; compared by identity only. */
	readonly payload: unknown;
	/** The mounted Positioner's measured state (for the safe polygon's side). */
	readonly positionerClaim: ClaimedValue<PositionerStore<T>>;
	/** The popup element's id, claimed while the element is in the document. */
	readonly popupIdClaim: ClaimedValue<string>;

	// Interactions the store owns
	/** The popup's hover state: its timers, its pointer and the active safe polygon. */
	readonly hover: HoverInteraction<T>;
	/** The popup's dismissal: the decisions, and the press being followed. */
	readonly dismiss: DismissInteraction<T>;
	/**
	 * The guards that carry Tab between the active trigger and the portalled popup, for a kind
	 * whose trigger renders them.
	 */
	readonly guards?: TriggerFocusGuards<T> | undefined;

	// The kind's answers
	/** Whether the focus manager is off now. */
	readonly focusManagerDisabled: boolean;
	/** Whether the popup traps focus now. */
	readonly focusManagerModal: boolean;
	/** Whether a hovered popup stays open now. */
	readonly hoverPopupEnabled: boolean;
	/** How long a hover close waits once the pointer leaves the popup. */
	readonly closeDelay: number;
	/** Whether the page scroll is locked now. */
	readonly anchoredScrollLockEnabled: boolean;
	/** Whether the Positioner lets pointer input through. */
	readonly positionerIgnoresPointer: boolean;
	/** Whether a trigger with these options opens the popup on hover now. */
	triggerHoverEnabled(openOnHover: boolean, disabled: boolean): boolean;
	/** Whether the trigger with `triggerId` renders the focus guards now. */
	hasTriggerFocusGuards(triggerId: string | undefined): boolean;
	/** The initial focus: the part's prop when given, else the kind's default. */
	resolveInitialFocus<Target>(initialFocus: Target | undefined): unknown;

	// Intents
	/** Opens or closes the popup. Returns whether the change went through. */
	setOpen(
		open: boolean,
		details: ChangeEventDetails<string, {}, T>,
		source?: OpenChangeSource,
	): boolean;
	/** Records how the popup is being opened, before the open change. */
	setOpenMethod(method: InteractionType | null): void;
	setPopupElement(element: T["element"] | null): void;
	setPositionerElement(element: T["element"] | null): void;
	/** Reports a finished opening. */
	completeOpen(): void;
	/** Ends the closing phase. */
	unmount(): void;
	/** Adds the popup's node to the popup tree under `parentId`; returns the removal. */
	joinPopupTree(id: string, parentId: string | null): () => void;
	/** Registers a trigger element under `id` with its data; returns the unregistration. */
	registerTrigger(id: string, element: T["element"], data: PopupTriggerData<unknown>): () => void;
	/** While the trigger `id` owns the mounted popup, its element and data are the popup's. */
	forwardTriggerData(
		id: string,
		element: T["element"] | null,
		data: PopupTriggerData<unknown>,
	): void;
	/** The trigger reads this popup until the returned leave. */
	joinTrigger(): () => void;
}
