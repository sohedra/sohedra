import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverViewportState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartPopupWrapper from "./popover-popup-wrapper.svelte";

/**
 * Popover.Viewport as the conformance suite sees it: in Root > Portal > Positioner > Popup. Its
 * state (a trigger switch in progress) can't be set through props, so the suite
 * runs its stateless checks. The portal renders after mount only, so the server leaves it out.
 */
export const popoverViewportConformance: ConformanceSetup<PopoverViewportState> = {
	part: Popover.Viewport as Component<Record<string, unknown>>,
	wrapper: PartPopupWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	clientOnly: true,
	axe: {
		disable: {
			"aria-dialog-name":
				"the wrapper renders the popup without a Title (and gives it no name); the component's axe test names it",
		},
	},
};
