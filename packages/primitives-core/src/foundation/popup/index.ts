// Popup: what every popup shares: its store and open pipeline, the behaviour rows, trigger registration, the Portal's and a trigger's state, the handle base, the popup tree and the open-change details.
export { POPUP_BEHAVIOR, type PopupBehavior } from "./popup-behavior.js";
export { type ClosePartCount, closePartCount, useClosePart } from "./popup-close-parts.svelte.js";
export { type PopupNode, PopupTree } from "./popup-tree.js";
export {
	detachedPopupDeps,
	HANDLE_ATTACH,
	HANDLE_STORE,
	PopupHandle,
} from "./popup-handle.svelte.js";
export { isNestedInPopup, movesToOtherTrigger, pressOpenState } from "./popup-rules.js";
export {
	type PopupHooks,
	type PopupRequest,
	PopupStore,
	type PopupStoreDeps,
	type PopupStoreKind,
	type PopupStoreProps,
} from "./popup-store.svelte.js";
export {
	PopupPortalStore,
	type PopupPortalStoreDeps,
	type PopupPortalStoreProps,
} from "./popup-portal-store.svelte.js";
export { useTriggerRegistration } from "./popup-trigger-registration.svelte.js";
export { PopupTriggerStore, type PopupTriggerStoreProps } from "./popup-trigger-store.svelte.js";
export type {
	InstantType,
	InteractionType,
	OpenChangeDetails,
	OpenChangeSource,
	PopupPortalState,
	PopupTriggerData,
	PopupTriggerState,
} from "./popup-types.js";
export type { PopupView } from "./popup-view.js";
