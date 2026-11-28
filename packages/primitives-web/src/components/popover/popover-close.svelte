<!--
  @component
  A button that closes the popover. Renders a `<button>` element.
-->
<script lang="ts">
	import { REASONS } from "@sohedra/primitives-core/foundation/kernel";
	import { useClosePart } from "@sohedra/primitives-core/foundation/popup";
	import type { MouseEventHandler } from "svelte/elements";

	import { useButton } from "../../foundation/button/index.js";
	import { createChangeEventDetails, Part } from "../../foundation/kernel/index.js";
	import { PopoverPopupContext, PopoverRootContext } from "./popover-context.js";
	import type { PopoverCloseProps } from "./popover-types.js";

	// 1. Props
	let {
		disabled = false,
		nativeButton = true,
		ref = $bindable(null),
		...rest
	}: PopoverCloseProps = $props();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Close");
	const popup = PopoverPopupContext.getOr(null);

	// 3. Shared behaviours
	const button = useButton(() => ({
		disabled,
		focusableWhenDisabled: false,
		native: nativeButton,
	}));

	// 4. Own wiring
	const onclick: MouseEventHandler<HTMLElement> = (event) => {
		popover.close(createChangeEventDetails(REASONS.closePress, event));
	};

	// Counted by the Popup it is in (a modal popover traps focus only with a Close part inside).
	useClosePart(popup);
</script>

<Part tag="button" bind:ref state={popover.closeState} {onclick} user={rest} after={button.after} />
