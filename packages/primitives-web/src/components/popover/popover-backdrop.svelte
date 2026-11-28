<!--
  @component
  An overlay displayed beneath the popover. Renders a `<div>` element.
-->
<script lang="ts">
	import { PopupBackdrop } from "../../foundation/popup/index.js";
	import { popoverBackdropAttributes } from "./popover-attributes.js";
	import { PopoverRootContext } from "./popover-context.js";
	import type { PopoverBackdropProps } from "./popover-types.js";

	// 1. Props
	let { ref = $bindable(null), ...rest }: PopoverBackdropProps = $props();

	// 2. Store and context
	const popover = PopoverRootContext.get();
</script>

<PopupBackdrop
	bind:ref
	state={popover.backdropState}
	attrs={popoverBackdropAttributes}
	mounted={popover.mounted}
	passPointer={popover.backdropPassesPointer}
	user={rest}
/>
