import type { REASONS } from "@sohedra/primitives-core/foundation/kernel";
import type { InteractionType, PopupView } from "@sohedra/primitives-core/foundation/popup";
import type { HTMLAttributes } from "svelte/elements";

import type { SohedraChangeEventDetails, WebTypes } from "../kernel/index.js";
import type { PortalStore } from "../portal/index.js";

/** The details of a close that happens because focus left the popup. */
export type FocusOutDetails = SohedraChangeEventDetails<typeof REASONS.focusOut>;

/** Where focus goes when a popup opens or closes. */
export type FocusTarget =
	| boolean
	| HTMLElement
	| null
	| ((interactionType: InteractionType) => boolean | HTMLElement | null | void)
	| undefined;

/** A popup's focus behaviour, as a plain object the part builds from its props and store. */
export interface FocusManagerOptions {
	/** Whether the manager is off: while unmounted, or for an opening that never takes focus. */
	readonly disabled: boolean;
	/**
	 * Whether focus is trapped and outside content hidden.
	 * @default true
	 */
	readonly modal?: boolean | undefined;
	/**
	 * Where focus goes on open.
	 * @default true
	 */
	readonly initialFocus?: FocusTarget | undefined;
	/**
	 * Where focus returns on close. A target that isn't a boolean is the user's explicit one, which
	 * takes focus even when it moved elsewhere after opening.
	 * @default true
	 */
	readonly returnFocus?: FocusTarget | undefined;
	/**
	 * Where focus goes when the focused element inside is removed.
	 * @default false
	 */
	readonly restoreFocus?: boolean | "popup" | undefined;
	/** The kind of input that opened the popup. Only an explicit `null` is a programmatic open. */
	readonly openInteractionType?: InteractionType | null | undefined;
}

/** What a focus manager reads once, from around its Popup part. */
export interface FocusManagerFixed {
	/** The portal the popup renders in, if any. */
	readonly portal: PortalStore | null;
	/**
	 * For a popup whose trigger renders focus guards: the Tab bridge between the trigger and the
	 * portalled popup (its store, which keeps the guards).
	 */
	readonly bridge?: PopupView<WebTypes> | undefined;
}

export interface FocusManager {
	/** Whether the Popup renders the two guards around its element. */
	readonly guarded: boolean;
	/** Spread on a `<span>` right before the Popup's element. It holds an attachment. */
	readonly guardBefore: HTMLAttributes<HTMLSpanElement>;
	/** Spread on a `<span>` right after the Popup's element. It holds an attachment. */
	readonly guardAfter: HTMLAttributes<HTMLSpanElement>;
}

/** What a trigger's focus guards read, from the options function. */
export interface TriggerFocusGuardsOptions {
	/** The popup the trigger reads now: a handle's store changes when a Root attaches. */
	readonly popup: PopupView<WebTypes>;
	/** The trigger element, once attached. */
	readonly trigger: HTMLElement | null;
}

export interface TriggerFocusGuards {
	/** Spread on a `<span>` right before the trigger's element. It holds an attachment. */
	readonly guardBefore: HTMLAttributes<HTMLSpanElement>;
	/** Spread on a `<span>` right after the trigger's element. It holds an attachment. */
	readonly guardAfter: HTMLAttributes<HTMLSpanElement>;
}
