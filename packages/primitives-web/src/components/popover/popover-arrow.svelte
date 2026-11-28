<!--
  @component
  Displays an element positioned against the popover anchor. Renders a `<div>` element.
-->
<script lang="ts">
	import { popupStateMapping } from "../../foundation/popup/index.js";
	import { AnchoredArrow } from "../../foundation/position/index.js";
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
	attrs={popupStateMapping}
	{positioner}
	user={rest}
/>
