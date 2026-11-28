<!--
  @component
  Displays an element positioned against the popover anchor. Renders a `<div>` element.
-->
<script lang="ts">
	import { popoverArrowState } from "@sohedra/primitives-core/components/popover/index.js";

	import { AnchoredArrow } from "../../foundation/position/index.js";
	import { popoverArrowAttributes } from "./popover-attributes.js";
	import { PopoverPositionerContext, PopoverRootContext } from "./popover-context.js";
	import type { PopoverArrowProps } from "./popover-types.js";

	// 1. Props
	let { ref = $bindable(null), ...rest }: PopoverArrowProps = $props();

	// 2. Store and context
	const popover = PopoverRootContext.get();
	const positioner = PopoverPositionerContext.get();
</script>

<AnchoredArrow
	bind:ref
	state={popoverArrowState(popover, positioner)}
	attrs={popoverArrowAttributes}
	{positioner}
	user={rest}
/>
