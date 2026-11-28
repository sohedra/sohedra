// Portal (web only: core has no portal code): moves a popup's subtree into another container, with focus managed across the move, as the shared Portal part.
export { FloatingPortalContext, FloatingPortalState } from "./portal-context.svelte.js";
export { default as PopupPortal } from "./portal-popup.svelte";
export type { PortalContainer } from "./portal-wiring.svelte.js";
