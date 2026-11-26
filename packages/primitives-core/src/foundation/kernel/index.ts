// Kernel: what every store uses: contexts, ids, logging, events, reactivity and the Platform contract.
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
export { Controllable, type ControllableSource } from "./kernel-controllable.svelte.js";
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
