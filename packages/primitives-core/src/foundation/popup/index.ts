// Popup: what every popup shares: its store and open pipeline, the behaviour rows, trigger registration, the handle base, the floating tree and the open-change details.
export { POPUP_BEHAVIOR, type PopupBehavior } from "./popup-behavior.js";
export { type FloatingNode, FloatingTree } from "./popup-floating-tree.js";
export { detachedPopupDeps, PopupHandle } from "./popup-handle.svelte.js";
export type { PopupHooks, PopupRequest, TriggerChangeWait } from "./popup-lifecycle.svelte.js";
export { isNestedInFloating, pressOpenState } from "./popup-rules.js";
export {
	PopupStore,
	type PopupStoreDeps,
	type PopupStoreKind,
	type PopupStoreProps,
} from "./popup-store.svelte.js";
export {
	type TriggerRegistrationView,
	useTriggerRegistration,
} from "./popup-trigger-registration.svelte.js";
export type {
	InstantType,
	InteractionType,
	OpenChangeDetails,
	OpenChangeSource,
	PopupTriggerData,
} from "./popup-types.js";
