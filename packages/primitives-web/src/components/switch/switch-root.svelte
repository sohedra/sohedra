<!--
  @component
  Represents the switch itself. Renders a `<span>` element and a hidden `<input>` beside it.
-->
<script lang="ts">
	import { SwitchStore } from "@sohedra/primitives-core/components/switch/index.js";
	import { bound, sohedraId } from "@sohedra/primitives-core/foundation/kernel/index.js";

	import {
		FieldRootContext,
		FieldsetRootContext,
		LabelableContext,
		NULL_FIELD,
		NULL_FIELDSET,
		NULL_LABELABLE,
		useCheckedControl,
	} from "../../foundation/form/index.js";
	import { Part, type WebTypes } from "../../foundation/kernel/index.js";
	import { switchAttributes } from "./switch-attributes.js";
	import { SwitchRootContext } from "./switch-context.js";
	import type { SwitchRootProps } from "./switch-types.js";

	// 1. Props
	let {
		checked = $bindable(),
		defaultChecked,
		onCheckedChange,
		disabled,
		readOnly,
		required,
		name,
		form,
		value,
		uncheckedValue,
		id,
		nativeButton = false,
		"aria-labelledby": ariaLabelledBy,
		inputRef = $bindable(null),
		ref = $bindable(null),
		...rest
	}: SwitchRootProps = $props();

	const uid = $props.id();

	// 2. Store and context
	const sw = new SwitchStore<WebTypes>(
		() => ({
			defaultChecked,
			onCheckedChange,
			disabled,
			readOnly,
			required,
			name,
			uncheckedValue,
			id,
			nativeButton,
			labelledBy: ariaLabelledBy,
			label: rest["aria-label"],
		}),
		{
			checked: bound(
				() => checked,
				(next) => (checked = next),
			),
			field: FieldRootContext.getOr(NULL_FIELD),
			fieldset: FieldsetRootContext.getOr(NULL_FIELDSET),
			labelable: LabelableContext.getOr(NULL_LABELABLE),
			inputId: sohedraId(uid, "input"),
		},
	);
	sw.connect();
	SwitchRootContext.set(sw);

	// 3. Shared behaviours
	const input = bound(
		() => inputRef,
		(element) => (inputRef = element),
	);
	const control = useCheckedControl(sw, () => ({
		type: "checkbox",
		rootId: sohedraId(uid),
		native: nativeButton,
		form,
		value,
		uncheckedValue,
		inputRef: input,
	}));
</script>

<!-- No whitespace between the elements: it would render text beside the switch. -->
<Part
	tag="span"
	bind:ref
	state={sw.state}
	attrs={switchAttributes}
	id={control.id}
	role="switch"
	aria-checked={sw.checked}
	aria-readonly={sw.readOnly || undefined}
	aria-required={sw.required || undefined}
	{...control.props}
	user={rest}
	after={control.after}
/>{#if sw.submitsUncheckedValue}<input {...control.unchecked} />{/if}<input {...control.hidden} />
