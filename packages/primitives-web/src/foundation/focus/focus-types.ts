import type { TriggerFocusGuards } from "@sohedra/primitives-core/foundation/focus/index.js";
import type { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type {
	FloatingTree,
	InteractionType,
	OpenChangeDetails,
} from "@sohedra/primitives-core/foundation/popup/index.js";
import type { HTMLAttributes } from "svelte/elements";

import type { SohedraChangeEventDetails, WebTypes } from "../kernel/index.js";
import type { FloatingPortalState } from "../portal/index.js";

/** The details of a close that happens because focus left the popup. */
export type FocusOutDetails = SohedraChangeEventDetails<typeof REASONS.focusOut>;

/** Where focus goes when a popup opens or closes. */
export type FocusTarget =
	| boolean
	| HTMLElement
	| null
	| ((interactionType: InteractionType) => boolean | HTMLElement | null | void)
	| undefined;

/**
 * Everything the focus manager reads from a popup, and the one thing it asks of it. The names are
 * a popup store's own, so a part hands its store over as it is; the manager can reach nothing
 * else of it.
 */
export interface FocusManagerView {
	readonly open: boolean;
	/** Whether the popup is in the document: open, or closing. */
	readonly mounted: boolean;
	/** The positioned element that holds the popup. */
	readonly floatingElement: Element | null;
	/** The element the popup is anchored to. Focus returns to it. */
	readonly anchorElement: Element | null;
	/** The tree of nested popups, so focus moving into a child or a parent isn't focus leaving. */
	readonly tree: FloatingTree<WebTypes> | null;
	/** The popup's node in {@link tree}. */
	readonly nodeId: string | undefined;
	/** The event that opened the popup. */
	readonly openEvent: Event | undefined;
	/** Whether focus or a press is moving inside the popup's own elements right now. */
	readonly dismiss: {
		readonly insideTree: boolean;
		/** Focus is moving inside the popup's own elements. */
		enterInside(): void;
		/** Nothing is moving inside the popup's elements any more. */
		leaveInside(): void;
	};
	/** The popup's registered triggers. */
	readonly triggers: {
		hasMatchingElement(predicate: (element: Element) => boolean): boolean;
	};
	/** The popup's open changes, with the reason and the event of each. */
	readonly events: {
		on(event: "openchange", listener: (details: OpenChangeDetails<WebTypes>) => void): void;
		off(event: "openchange", listener: (details: OpenChangeDetails<WebTypes>) => void): void;
	};
	/** Closes the popup because focus left it. The manager only ever passes focus-out details. */
	setOpen(open: boolean, details: FocusOutDetails): void;
}

/** A popup's focus behaviour, as a plain object the part builds from its props and store. */
export interface FocusManagerOptions {
	/** Whether the manager is off: while the popup is unmounted, or for an opening that never takes focus. */
	readonly disabled: boolean;
	/** Whether focus is trapped and outside content hidden. @default true */
	readonly modal?: boolean | undefined;
	/** @default true */
	readonly initialFocus?: FocusTarget;
	/**
	 * Where focus returns on close. A target that isn't a boolean is the user's explicit one, which
	 * takes focus even when it moved elsewhere after opening. @default true
	 */
	readonly returnFocus?: FocusTarget;
	/** Where focus goes when the focused element inside is removed. @default false */
	readonly restoreFocus?: boolean | "popup" | undefined;
	/** The kind of input that opened the popup. Only an explicit `null` is a programmatic open. */
	readonly openInteractionType?: InteractionType | null | undefined;
}

/**
 * The Tab bridge between a trigger and its portalled popup: the popup is elsewhere in the
 * document, so guards around the trigger and around the popup carry Tab from one to the other. A
 * store that keeps the guards satisfies it as it is.
 */
export interface TriggerFocusBridge {
	readonly guards: TriggerFocusGuards<WebTypes>;
	/** The trigger that owns the popup, while it is mounted. */
	readonly activeTriggerElement: Element | null;
}

/** What a focus manager is given from around its Popup part. */
export interface FocusManagerDeps {
	/** The portal the popup renders in, if any. */
	readonly portal: FloatingPortalState | null;
	/** For a popup whose trigger renders focus guards. */
	readonly bridge?: TriggerFocusBridge | undefined;
}

/** The props of one focus guard `<span>`, with the attachment that registers it. */
export type FocusGuardProps = HTMLAttributes<HTMLSpanElement>;

export interface FocusManager {
	/** Installs the manager's effects. Call once, while the Popup part initialises. */
	/** Whether the Popup renders the two guards around its element. */
	readonly renderGuards: boolean;
	/** Spread on a `<span>` right before the Popup's element. */
	readonly beforeGuard: FocusGuardProps;
	/** Spread on a `<span>` right after the Popup's element. */
	readonly afterGuard: FocusGuardProps;
}

/** What the trigger's focus guards read from a popup, and the one thing they ask of it. */
export interface TriggerFocusGuardsView {
	readonly guards: TriggerFocusGuards<WebTypes>;
	/** The positioned element that holds the popup. */
	readonly positionerElement: Element | null;
	/** Closes the popup because focus left it. Only focus-out details are passed. */
	setOpen(open: boolean, details: FocusOutDetails): void;
}

export interface TriggerFocusGuardProps {
	/** Spread on a `<span>` right before the trigger's element. */
	readonly before: FocusGuardProps;
	/** Spread on a `<span>` right after the trigger's element. */
	readonly after: FocusGuardProps;
}

/** What a trigger's record of how it opens its popup reads from the popup and asks of it. */
export interface OpenMethodView {
	readonly open: boolean;
	/** Records how the popup is being opened, before the open change. */
	setOpenMethod(method: InteractionType | null): void;
}
