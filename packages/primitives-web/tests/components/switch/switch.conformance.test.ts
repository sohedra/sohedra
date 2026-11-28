// The shared suites Switch's parts run: the part contract for Switch.Thumb, and the checked-control
// suite for Switch.Root.
import { describeCheckedControl } from "../../conformance/conformance-checked-control.js";
import { describeConformance } from "../../conformance/conformance-part.js";
import SwitchDemo from "./fixtures/switch-demo.svelte";
import SwitchInForm from "./fixtures/switch-in-form.svelte";
import SwitchRootBound from "./fixtures/switch-root-bound.svelte";
import { switchThumbConformance } from "./fixtures/switch-thumb-conformance.js";

describeConformance("Switch.Thumb", () => switchThumbConformance);

describeCheckedControl("Switch.Root", () => ({
	role: "switch",
	inputType: "checkbox",
	demo: SwitchDemo,
	bound: SwitchRootBound,
	inForm: SwitchInForm,
}));
