import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverTriggerState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartTriggerWrapper from "./popover-trigger-wrapper.svelte";

/**
 * Popover.Trigger as the conformance suite sees it: inside a Popover.Root whose `open` the state
 * props set. The root names the trigger with `triggerId`, so the server renders it open too
 * (a trigger otherwise becomes the active one after hydration). Its own click handler toggles the
 * popover, read back from `aria-expanded`.
 */
export const popoverTriggerConformance: ConformanceSetup<PopoverTriggerState> = {
	part: Popover.Trigger as Component<Record<string, unknown>>,
	wrapper: PartTriggerWrapper as Component<ConformanceWrapperProps>,
	props: { id: "conformance-trigger" },
	defaultTag: "button",
	state: {
		attribute: "data-popup-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
	readOwnClick: (element) => element.getAttribute("aria-expanded"),
};
