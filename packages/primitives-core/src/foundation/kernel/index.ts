// Kernel: what every store uses: contexts, ids, logging, events, reactivity, timers and the Platform contract with the facts a platform passes in.
export { type DefinedContext, defineContext } from "./kernel-context.js";
export { sohedraId } from "./kernel-id.js";
export { error, warn } from "./kernel-log.js";

export {
	type AnyPlatformEvent,
	type Collator,
	type CollatorOptions,
	type FocusOptions,
	type FocusService,
	type FormService,
	inertPlatform,
	type LocaleService,
	type NumberFormatOptions,
	type NumberFormatter,
	type OrderService,
	type Platform,
	type PlatformEvent,
	type PlatformTypes,
	type Scheduler,
} from "./kernel-platform.js";

export { bound, type Bound } from "./kernel-bound.js";
export { CommittedValue } from "./kernel-committed-value.svelte.js";
export { Controllable } from "./kernel-controllable.svelte.js";
export { watch, type WatchOptions } from "./kernel-watch.svelte.js";

export { callUser } from "./kernel-user-callback.js";
export {
	type ChangeEventDetails,
	createChangeEventDetails,
	createGenericEventDetails,
	type GenericEventDetails,
} from "./kernel-change-details.js";
export { type SohedraEvent, type WithSohedraEvent } from "./kernel-types.js";
export { REASONS } from "./kernel-reasons.js";
export { OwnedValue } from "./kernel-owned-value.svelte.js";
export type { InteractionEventType, KeyInput, PointerType } from "./kernel-platform-values.js";
export { keepShallowEqual } from "./kernel-shallow-equal.js";
export { Timeout } from "./kernel-timeout.js";
export type { TextDirection } from "./kernel-types.js";
