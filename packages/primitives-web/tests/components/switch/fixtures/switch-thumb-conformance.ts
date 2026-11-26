import type { Component } from "svelte";

import SwitchThumb from "#lib/components/switch/switch-thumb.svelte";
import type { SwitchThumbState } from "#lib/components/switch/types.js";

import type { ConformanceSetup } from "../../../conformance/conformance-setup.js";
import SwitchThumbWrapper from "./switch-thumb-wrapper.svelte";

/** Switch.Thumb as the conformance suite sees it: its state is the root's, set by the wrapper. */
export const switchThumbConformance: ConformanceSetup<SwitchThumbState> = {
	part: SwitchThumb as Component<Record<string, unknown>>,
	wrapper: SwitchThumbWrapper,
	defaultTag: "span",
	state: {
		attribute: "data-checked",
		on: { checked: true },
		off: { checked: false },
		isOn: (state) => state.checked,
	},
};
