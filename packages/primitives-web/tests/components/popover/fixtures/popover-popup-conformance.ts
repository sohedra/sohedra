import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartPositionerWrapper from "./popover-positioner-wrapper.svelte";

/**
 * Popover.Popup as the conformance suite sees it: in Root > Portal > Positioner.
 * The state props set the root's `open`; the portal is kept mounted so the closed popup stays.
 * The portal renders after mount only, so the server leaves the popup out.
 */
export const popoverPopupConformance: ConformanceSetup<PopoverPopupState> = {
	part: Popover.Popup as Component<Record<string, unknown>>,
	wrapper: PartPositionerWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	state: {
		attribute: "data-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
	clientOnly: true,
	axe: { props: { "aria-label": "Popover" } },
};
