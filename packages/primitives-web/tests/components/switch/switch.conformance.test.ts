// The shared suites Switch's parts run: the part contract for Switch.Thumb, and the checked-control
// suite for Switch.Root.
import type { Component } from "svelte";

import SwitchThumb from "#lib/components/switch/switch-thumb.svelte";
import type { SwitchThumbState } from "#lib/components/switch/switch-types.js";

import { describeCheckedControl } from "../../conformance/conformance-checked-control.js";
import { describeConformance } from "../../conformance/conformance-part.js";
import type { ConformanceSetup } from "../../conformance/conformance-setup.js";
import SwitchDemo from "./fixtures/switch-demo.svelte";
import SwitchInForm from "./fixtures/switch-in-form.svelte";
import SwitchRootBound from "./fixtures/switch-root-bound.svelte";
import SwitchThumbWrapper from "./fixtures/switch-thumb-wrapper.svelte";

/** Switch.Thumb as the conformance suite sees it: its state is the root's, set by the wrapper. */
const thumbSetup: ConformanceSetup<SwitchThumbState> = {
	part: SwitchThumb as Component<Record<string, unknown>>,
	wrapper: SwitchThumbWrapper,
	defaultTag: "span",
	server: {
		part: {
			url: new URL("../../../src/components/switch/switch-thumb.svelte", import.meta.url).href,
			name: "default",
		},
		wrapper: {
			url: new URL("./fixtures/switch-thumb-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	state: {
		attribute: "data-checked",
		on: { checked: true },
		off: { checked: false },
		isOn: (state) => state.checked,
	},
};

describeConformance("Switch.Thumb", () => thumbSetup);

describeCheckedControl("Switch.Root", () => ({
	role: "switch",
	inputType: "checkbox",
	demo: SwitchDemo,
	bound: SwitchRootBound,
	inForm: SwitchInForm,
}));
