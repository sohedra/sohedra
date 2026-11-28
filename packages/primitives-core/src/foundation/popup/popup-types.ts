// The types every popup shares: what an open change carries in and out, what a trigger forwards,
// the Portal's and a trigger's part state, and the popup's own events.

import type {
	AnyPlatformEvent,
	ChangeEventDetails,
	InteractionEventType,
	PlatformTypes,
	PointerType,
} from "../kernel/index.js";

/** Change details every popup's `onOpenChange` receives (`preventUnmountOnClose` included). */
export type PopupChangeEventDetails<
	T extends PlatformTypes,
	Reason extends string = string,
> = ChangeEventDetails<Reason, { preventUnmountOnClose: () => void }, T>;

/** What the platform knows about an open change, passed with it. */
export interface OpenChangeSource {
	/**
	 * The interaction that caused the change, in core's vocabulary (a tap is `click`): whether it
	 * came from a press or a hover. `imperative-action` for a handle's change; none for a change
	 * without an event or with one core doesn't interpret.
	 */
	readonly eventType?: InteractionEventType | undefined;
	/** The trigger's id when the store may not know the element (a handle's other root). */
	readonly triggerId?: string | undefined;
}

/** What a trigger forwards to the popup while it owns it. */
export interface PopupTriggerData<Payload> {
	readonly payload: Payload | undefined;
}

/** The kind of input that opened or closed a popup: a pointer type, or the keyboard. */
export type InteractionType = PointerType | "keyboard";

/** Why a popup skips its CSS transitions (`data-instant`). */
export type InstantType = "dismiss" | "click" | "focus" | "group" | "trigger-change" | undefined;

/** A popup Portal part's state: it has no fields. */
export interface PopupPortalState {}

/** A popup trigger part's state. */
export interface PopupTriggerState {
	/** Whether the trigger is currently disabled. */
	disabled: boolean;
	/** Whether the popup is currently open and was opened by this trigger. */
	open: boolean;
}

/** What an open change tells the popup's interactions. */
export interface OpenChangeDetails<T extends PlatformTypes = PlatformTypes> {
	open: boolean;
	reason: string;
	event: AnyPlatformEvent<T>;
	/** Whether the popup is nested in another popup. */
	nested: boolean;
	trigger: T["element"] | undefined;
}

/** A popup's own events: open changes, which its dismiss, focus and hover interactions follow. */
export type PopupEvents<T extends PlatformTypes = PlatformTypes> = {
	openchange: OpenChangeDetails<T>;
};
