// Popup: what every popup shares: its store and open pipeline, the session of an opening, the behaviour rows, triggers, the handle base, the floating tree and the popup's events.
export { POPUP_BEHAVIOR, type PopupBehavior } from "./popup-behavior.js";
export { type FloatingNode, FloatingTree } from "./popup-floating-tree.js";
export { PopupHandle, detachedPopupDeps } from "./popup-handle.svelte.js";
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
