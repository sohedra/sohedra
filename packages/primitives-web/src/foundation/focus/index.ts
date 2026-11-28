// Focus: a popup's focus on the web: the focus manager, the open method, the focus guards and the markers the popup wiring finds elements by.
export { focusGuardProps } from "./focus-guard.js";
export { useFocusManager } from "./focus-manager.svelte.js";
export {
	CLICK_TRIGGER_IDENTIFIER,
	FOCUSABLE_POPUP_PROPS,
	INERT_MARKER,
	PORTAL_ATTRIBUTE,
} from "./focus-markers.js";
export { useOpenMethod } from "./focus-open-method.js";
export { useTriggerFocusGuards } from "./focus-trigger-guards.js";
export type {
	FocusGuardProps,
	FocusManagerView,
	FocusTarget,
	OpenMethodView,
	TriggerFocusBridge,
	TriggerFocusGuardsView,
} from "./focus-types.js";
