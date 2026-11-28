<!--
  @component
  An overlay displayed beneath the popover. Renders a `<div>` element.
-->
<script lang="ts">
	import { PopupBackdrop, popupTransitionStateMapping } from "../../foundation/popup/index.js";
	import { PopoverRootContext } from "./popover-context.js";
	import type { PopoverBackdropProps } from "./popover-types.js";

	// 1. Props
	let { ref = $bindable(null), ...rest }: PopoverBackdropProps = $props();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Backdrop");
</script>

<PopupBackdrop
	bind:ref
	state={popover.backdropState}
	attrs={popupTransitionStateMapping}
	mounted={popover.mounted}
	passPointer={popover.backdropPassesPointer}
	user={rest}
/>
