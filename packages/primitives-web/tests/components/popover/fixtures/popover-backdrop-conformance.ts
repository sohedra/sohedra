import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverBackdropState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartBackdropWrapper from "./popover-backdrop-wrapper.svelte";

/**
 * Popover.Backdrop as the conformance suite sees it: inside a Popover.Root whose
 * `open` the state props set. The wrapper cancels the outside press a click on the backdrop is,
 * which would otherwise close the popover and hide the backdrop before the suite's second click.
 */
export const popoverBackdropConformance: ConformanceSetup<PopoverBackdropState> = {
	part: Popover.Backdrop as Component<Record<string, unknown>>,
	wrapper: PartBackdropWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	state: {
		attribute: "data-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
};
