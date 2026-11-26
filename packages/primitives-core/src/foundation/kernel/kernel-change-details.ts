import type { PlatformEvent, PlatformTypes } from "./kernel-platform.js";

// Core never constructs or reads the event: the platform passes it in (an imperative change gets
// the platform's event for a change with no native one), and core only forwards it.

type ChangeEventDetail<
	Reason extends string,
	CustomProperties extends object,
	T extends PlatformTypes,
> = {
	/** The reason for the event. */
	reason: Reason;
	/** The native event associated with the custom event. */
	event: PlatformEvent<T, Reason>;
	/** Cancels Sohedra from handling the event. */
	cancel: () => void;
	/** Allows the event to propagate in cases where Sohedra will stop the propagation. */
	allowPropagation: () => void;
	/** Indicates whether the event has been canceled. */
	isCanceled: boolean;
	/** Indicates whether the event is allowed to propagate. */
	isPropagationAllowed: boolean;
	/** The element that triggered the event, if applicable. */
	trigger: T["element"] | undefined;
} & CustomProperties;

/**
 * Details of a cancelable change on platform `T`: its `event` is the platform's event for the
 * reason, its `trigger` a platform element.
 */
export type ChangeEventDetails<
	Reason extends string,
	CustomProperties extends object,
	T extends PlatformTypes,
> = Reason extends string ? ChangeEventDetail<Reason, CustomProperties, T> & {} : never;

/**
 * Creates change details with the given reason and utilities for preventing Sohedra's internal
 * event handling. The event is required: core never constructs events, so the
 * platform passes its event for a change with no native one.
 */
export function createChangeEventDetails<
	Reason extends string,
	CustomProperties extends object,
	T extends PlatformTypes,
>(
	reason: Reason,
	event: PlatformEvent<T, Reason>,
	trigger?: T["element"],
	customProperties?: CustomProperties,
): ChangeEventDetails<Reason, CustomProperties, T> {
	let canceled = false;
	let allowPropagation = false;
	const details: ChangeEventDetail<Reason, CustomProperties, T> = {
		reason,
		event,
		cancel() {
			canceled = true;
		},
		allowPropagation() {
			allowPropagation = true;
		},
		get isCanceled() {
			return canceled;
		},
		get isPropagationAllowed() {
			return allowPropagation;
		},
		trigger,
		...(customProperties as CustomProperties),
	};
	return details as ChangeEventDetails<Reason, CustomProperties, T>;
}

type GenericEventDetail<
	Reason extends string,
	CustomProperties extends object,
	T extends PlatformTypes,
> = {
	/** The reason for the event. */
	reason: Reason;
	/** The native event associated with the custom event. */
	event: PlatformEvent<T, Reason>;
} & CustomProperties;

/** Details of a generic (non-cancelable) event on platform `T`. */
export type GenericEventDetails<
	Reason extends string,
	CustomProperties extends object,
	T extends PlatformTypes,
> = Reason extends string ? GenericEventDetail<Reason, CustomProperties, T> & {} : never;

/** Creates generic event details: a reason and the event, nothing to cancel. */
export function createGenericEventDetails<
	Reason extends string,
	CustomProperties extends object,
	T extends PlatformTypes,
>(
	reason: Reason,
	event: PlatformEvent<T, Reason>,
	customProperties?: CustomProperties,
): GenericEventDetails<Reason, CustomProperties, T> {
	const details: GenericEventDetail<Reason, CustomProperties, T> = {
		reason,
		event,
		...(customProperties as CustomProperties),
	};
	return details as GenericEventDetails<Reason, CustomProperties, T>;
}
