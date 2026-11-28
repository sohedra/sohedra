import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverArrowState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartPopupWrapper from "./popover-popup-wrapper.svelte";

/**
 * Popover.Arrow as the conformance suite sees it: in Root > Portal > Positioner > Popup. The
 * state props set the root's `open`; the portal is kept mounted so the closed arrow
 * stays. The portal renders after mount only, so the server leaves the arrow out.
 */
export const popoverArrowConformance: ConformanceSetup<PopoverArrowState> = {
	part: Popover.Arrow as Component<Record<string, unknown>>,
	wrapper: PartPopupWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	state: {
		attribute: "data-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
	clientOnly: true,
	axe: {
		disable: {
			"aria-dialog-name":
				"the wrapper renders the popup without a Title (and gives it no name); the component's axe test names it",
		},
	},
};
