import {
	type ChangeEventDetails,
	createChangeEventDetails as createPlatformChangeEventDetails,
	createGenericEventDetails as createPlatformGenericEventDetails,
	type GenericEventDetails,
	type PlatformEvent,
} from "@sohedra/primitives-core/foundation/kernel";

import type { WebTypes } from "./kernel-platform.js";

/** Details of custom change events emitted by Sohedra components. */
export type SohedraChangeEventDetails<
	Reason extends string,
	CustomProperties extends object = {},
> = ChangeEventDetails<Reason, CustomProperties, WebTypes>;

/** Details of generic (non-cancelable) events emitted by Sohedra components. */
export type SohedraGenericEventDetails<
	Reason extends string,
	CustomProperties extends object = {},
> = GenericEventDetails<Reason, CustomProperties, WebTypes>;

/**
 * Creates a Sohedra event details object with the given reason and utilities for preventing
 * Sohedra's internal event handling. The event is required: pass `fallbackEvent()` when there is
 * no native one.
 */
export function createChangeEventDetails<
	Reason extends string,
	CustomProperties extends object = {},
>(
	reason: Reason,
	event: PlatformEvent<WebTypes, Reason>,
	trigger?: Element,
	customProperties?: CustomProperties,
): SohedraChangeEventDetails<Reason, CustomProperties> {
	return createPlatformChangeEventDetails<Reason, CustomProperties, WebTypes>(
		reason,
		event,
		trigger,
		customProperties,
	);
}

/** Creates a generic Sohedra event details object: a reason and the event, nothing to cancel. */
export function createGenericEventDetails<
	Reason extends string,
	CustomProperties extends object = {},
>(
	reason: Reason,
	event: PlatformEvent<WebTypes, Reason>,
	customProperties?: CustomProperties,
): SohedraGenericEventDetails<Reason, CustomProperties> {
	return createPlatformGenericEventDetails<Reason, CustomProperties, WebTypes>(
		reason,
		event,
		customProperties,
	);
}
