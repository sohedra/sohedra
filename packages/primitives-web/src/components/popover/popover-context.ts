// Popover's contexts: defined here, on the web, and typed for the web. Core never reads a context.
// The contexts Popover shares with other popups (the popup tree and its nodes, the portal) are
// the popup and portal jobs'.

import type { PopoverStore } from "@sohedra/primitives-core/components/popover/index.js";
import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type { PositionerStore } from "@sohedra/primitives-core/foundation/position/index.js";

import type { WebTypes } from "../../foundation/kernel/index.js";

/** The popover a part sits in: Popover.Root sets its store. */
export const PopoverRootContext = defineContext<PopoverStore<unknown, WebTypes>>("Popover.Root");

/** The Positioner a part sits in: Popover.Positioner sets its measured state. */
export const PopoverPositionerContext =
	defineContext<PositionerStore<WebTypes>>("Popover.Positioner");

/** What Popover.Portal tells its descendants. */
export interface PopoverPortalView {
	/** Whether the portal keeps the popup mounted while closed. */
	readonly keepMounted: boolean;
}

/** The Portal a part sits in. */
export const PopoverPortalContext = defineContext<PopoverPortalView>("Popover.Portal");

/**
 * The Popup a part sits in: Popover.Popup sets its popover's store. A Close part counts only
 * inside one (a modal popover traps focus only with a Close part inside its Popup).
 */
export const PopoverPopupContext = defineContext<PopoverStore<unknown, WebTypes>>("Popover.Popup");
