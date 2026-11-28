// The types every popup shares: what an open change carries in and out, what a trigger forwards,
// and the popup's own events.

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
	 * The interaction that caused the change, in core's vocabulary (`click`, `mouseenter`,
	 * `keydown`…), which the platform maps its native event onto (a tap is `click`): whether the
	 * change came from a press or a hover. An imperative change passes `imperative-action`; none
	 * for a change without an event or with one core doesn't interpret.
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

/** What an open change tells the popup's interactions. */
export interface OpenChangeDetails<T extends PlatformTypes = PlatformTypes> {
	open: boolean;
	reason: string;
	nativeEvent: AnyPlatformEvent<T>;
	/** Whether the popup is nested in another floating element. */
	nested: boolean;
	triggerElement: T["element"] | undefined;
}

/** A popup's own events: open changes, which its dismiss, focus and hover interactions follow. */
export type PopupEvents<T extends PlatformTypes = PlatformTypes> = {
	openchange: OpenChangeDetails<T>;
};
