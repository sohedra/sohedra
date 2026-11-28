<!--
  @component
  Displays an element positioned against the popover anchor. Renders a `<div>` element.
-->
<script lang="ts">
	import { AnchoredArrow } from "../../foundation/position/index.js";
	import { popoverArrowAttributes } from "./popover-attributes.js";
	import { PopoverPositionerContext, PopoverRootContext } from "./popover-context.js";
	import type { PopoverArrowProps } from "./popover-types.js";

	// 1. Props
	let { ref = $bindable(null), ...rest }: PopoverArrowProps = $props();

	// 2. Store and context
	// The Arrow belongs in a Popover.Root: outside one this throws first.
	PopoverRootContext.get("Popover.Arrow");
	const positioner = PopoverPositionerContext.get("Popover.Arrow");
</script>

<AnchoredArrow
	bind:ref
	state={positioner.arrowState}
	attrs={popoverArrowAttributes}
	{positioner}
	user={rest}
/>
